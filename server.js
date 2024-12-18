const express = require('express');
const mysql = require('mysql2');
const Razorpay = require('razorpay');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const path = require('path');
const dotenv = require('dotenv');

const axios = require('axios');
const cheerio = require('cheerio');

// Load common settings from `.env`
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Load environment-specific settings (local or production)
const envFile = `.env.${process.env.NODE_ENV || 'local'}`;
dotenv.config({ path: path.resolve(__dirname, envFile) });
const app = express();
const port = process.env.PORT ||3000;

app.get('/', (req, res) => {
    res.send('Hello World');
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MySQL connection
const db = require('./db');

// Razorpay initialization
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});



// Generate API Key for a user
const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};



// SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

// Endpoint for contact form submission
app.post('/api/contact/insert', async (req, res) => {
  const { name, email, message, recaptchaToken } = req.body;

  // Validate required fields
  if (!name || !email || !message || !recaptchaToken) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Verify reCAPTCHA
  try {
    const recaptchaResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
      }
    );

    const { success } = recaptchaResponse.data;
    if (!success) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.' });
    }
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
  }

  // Insert contact into database
  const query = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';
  db.query(query, [name, email, message], (err) => {
    if (err) {
      console.error('Error inserting into database:', err);
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    // Send email notification to admin
    const mailOptions = {
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Contact Form Submission',
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ success: false, message: 'Failed to send email notification.' });
      }

      res.status(201).json({ success: true, message: 'Contact form submitted successfully.' });
    });
  });
});



// User registration route with reCAPTCHA verification
app.post('/api/register', async (req, res) => {
  const { username, email, password, recaptchaToken } = req.body;

  // Validate required fields
  if (!username || !email || !password || !recaptchaToken) {
    return res.status(400).json({ message: 'Username, email, password, and recaptcha response are required' });
  }

  // Verify reCAPTCHA
  try {
    const recaptchaVerificationResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,  // Your reCAPTCHA secret key
          response: recaptchaToken,
        },
      }
    );

    const { success } = recaptchaVerificationResponse.data;
    if (!success) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed' });
    }

    // Continue with user registration...
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking username', error: err });
      }
      if (result.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Check if email already exists
      db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error checking email', error: err });
        }
        if (result.length > 0) {
          return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash the password and insert into the database
        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
            return res.status(500).json({ message: 'Error hashing password', error: err });
          }

          db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err, result) => {
              if (err) {
                return res.status(500).json({ message: 'Error registering user', error: err });
              }

              const userId = result.insertId;
              const daysActive = 30;
              const activationDate = new Date();
              const expirationDate = new Date();
              expirationDate.setDate(activationDate.getDate() + daysActive);

              db.query(
                'INSERT INTO active_plans (user_id, plan_id, activation_date, days_active, expiration_date) VALUES (?, ?, ?, ?, ?)',
                [userId, 1, activationDate, daysActive, expirationDate],
                (err) => {
                  if (err) {
                    return res.status(500).json({ message: 'Error activating plan', error: err });
                  }

                  res.status(201).json({ message: 'User registered and plan activated successfully' });
                }
              );
            }
          );
        });
      });
    });
  } catch (error) {
    console.error('reCAPTCHA verification failed', error);
    return res.status(500).json({ message: 'reCAPTCHA verification failed' });
  }
});

// User login route (Optional: You can also add reCAPTCHA verification during login)
app.post('/api/login', async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  if (!email || !password || !recaptchaToken) {
    return res.status(400).json({ message: 'Email, password, and recaptcha response are required' });
  }

  try {
    // Verify reCAPTCHA
    const recaptchaVerificationResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,  // Your reCAPTCHA secret key
          response: recaptchaToken,
        },
      }
    );

    const { success } = recaptchaVerificationResponse.data;
    if (!success) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed' });
    }

    // Continue with user login logic...
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, users) => {
      if (err || users.length === 0) {
        return res.status(400).json({ message: 'User not found' });
      }

      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    });
  } catch (error) {
    console.error('reCAPTCHA verification failed', error);
    return res.status(500).json({ message: 'reCAPTCHA verification failed' });
  }
});

// Middleware to extract token from Authorization header
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Extract token from header

  if (!token) {
    return res.status(401).json({ message: 'Token is required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.userId = decoded.userId;  // Attach userId to request
    next();
  });
};

// Generate API key for user after login
app.post('/api/generate-api-key', authenticateToken, (req, res) => {
  const apiKey = generateApiKey();

  db.query(
    'INSERT INTO api_keys (api_key, user_id) VALUES (?, ?)',
    [apiKey, req.userId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error generating API key' });
      }
      res.json({ apiKey });
    }
  );
});

// URL shortening
app.post('/api/shorten-url', authenticateToken, (req, res) => {
  const { url } = req.body;

  // Check if the user has an active plan and its validity
  db.query(
    `SELECT ap.expiration_date, mp.url_limit, mp.daily_url_limit FROM active_plans ap
     INNER JOIN membership_plans mp ON ap.plan_id = mp.plan_id
     WHERE ap.user_id = ? ORDER BY ap.activation_date DESC LIMIT 1`,
    [req.userId],
    (err, activePlanResults) => {
      if (err || activePlanResults.length === 0) {
        return res.status(403).json({ message: 'You don\'t have an active plan. Please upgrade your plan.' });
      }

      const { expiration_date, url_limit, daily_url_limit } = activePlanResults[0];
      const currentDate = new Date();
      const expirationDate = new Date(expiration_date);

      // Check if the active plan has expired
      if (expirationDate < currentDate) {
        return res.status(403).json({ message: 'Your plan has expired. Please upgrade your plan.' });
      }

      // Check the number of URLs the user has already shortened today and this month
      db.query(
        `SELECT 
            COUNT(CASE WHEN DATE(ul.created_at) = CURDATE() THEN ul.user_id END) AS url_count_today,
            COUNT(CASE WHEN MONTH(ul.created_at) = MONTH(CURDATE()) AND YEAR(ul.created_at) = YEAR(CURDATE()) THEN ul.user_id END) AS url_count_month
         FROM urls ul
         WHERE ul.user_id = ?`,
        [req.userId],
        (err, urlCountResults) => {
          if (err || urlCountResults.length === 0) {
            return res.status(500).json({ message: 'Error fetching user URL data' });
          }

          const { url_count_today, url_count_month } = urlCountResults[0];

          // Check if the user has exceeded the daily limit
          if (url_count_today >= daily_url_limit) {
            return res.status(403).json({ message: 'Daily URL limit reached. Try again tomorrow.' });
          }

          // Check if the user has exceeded the monthly limit
          if (url_count_month >= url_limit) {
            return res.status(403).json({ message: 'Monthly URL limit reached. Upgrade your plan to shorten more URLs.' });
          }

          // If the user has an active plan and has not exceeded the limits, generate the shortened URL
          const shortenedUrl = crypto.randomBytes(4).toString('hex').slice(0, 7);
          // Insert the new shortened URL into the database
          db.query(
            'INSERT INTO urls (original_url, shortened_url, user_id) VALUES (?, ?, ?)',
            [url, shortenedUrl, req.userId],
            (err, result) => {
              if (err) {
                return res.status(500).json({ message: 'Error shortening URL' });
              }
              res.json({ shortenedUrl });
            }
          );
        }
      );
    }
  );
});

app.post('/api/upgrade-plan', authenticateToken, (req, res) => {
  const { planId, daysActive } = req.body;  // daysActive should be passed in the request body

  db.query('SELECT * FROM membership_plans WHERE plan_id = ?', [planId], (err, plans) => {
    if (err || plans.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const plan = plans[0];
    const activationDate = new Date();
    const expirationDate = new Date();
    expirationDate.setDate(activationDate.getDate() + daysActive);  // Calculate expiration date based on daysActive

    // Insert into the active_plans table
    db.query(
      'INSERT INTO active_plans (user_id, plan_id, activation_date, days_active, expiration_date) VALUES (?, ?, ?, ?, ?)',
      [req.userId, planId, activationDate, daysActive, expirationDate],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error updating membership plan', error: err });
        }

        // Update the user's plan in the users table
        db.query(
          'UPDATE users SET membership_plan_id = ? WHERE user_id = ?',
          [planId, req.userId],
          (err, result) => {
            if (err) {
              return res.status(500).json({ message: 'Error updating user plan' });
            }
            res.json({ message: `Plan upgraded to ${plan.name}`, plan });
          }
        );
      }
    );
  });
});

//Get Active Membership plan
app.get('/api/membership-plan', authenticateToken, (req, res) => {
  db.query(
    `SELECT 
        mp.name,
        mp.url_limit,  -- Monthly URL limit
        mp.daily_url_limit,  -- Daily URL limit
        COUNT(CASE WHEN DATE(ul.created_at) = CURDATE() THEN ul.user_id END) AS url_count_today,  -- Today's URL count
        COUNT(CASE WHEN MONTH(ul.created_at) = MONTH(CURDATE()) AND YEAR(ul.created_at) = YEAR(CURDATE()) THEN ul.user_id END) AS url_count_month,  -- This month's URL count
        ap.activation_date,
        ap.expiration_date
    FROM 
        membership_plans mp
    INNER JOIN 
        active_plans ap ON ap.plan_id = mp.plan_id
    INNER JOIN 
        users u ON ap.user_id = u.user_id
    LEFT JOIN 
        urls ul ON ul.user_id = u.user_id
    WHERE 
        u.user_id = ?
    GROUP BY 
        mp.name, mp.url_limit, mp.daily_url_limit, ap.activation_date, ap.expiration_date`,
    [req.userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching plan details', error: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'No membership plan found for the user' });
      }

      const { name, url_limit, daily_url_limit, url_count_today, url_count_month, activation_date, expiration_date } = results[0];

      // If there's no active plan or expired plan, handle appropriately
      if (!activation_date || !expiration_date || new Date(expiration_date) < new Date()) {
        return res.status(403).json({ message: 'Your plan has expired or there is no active plan. Please upgrade your plan.' });
      }

      // Calculate remaining days and URLs for the user
      const daysRemaining = Math.floor((new Date(expiration_date) - new Date()) / (1000 * 60 * 60 * 24));  // Calculate remaining days

      // Calculate the monthly limit and daily limit
      const monthlyLimit = url_limit;  // Monthly URL limit (from the database)
      const dailyLimit = daily_url_limit;  // Daily URL limit (from the database)
      
      // Calculate remaining URLs today and for the month
      const urlsRemainingToday = Math.max(dailyLimit - url_count_today, 0);  // Remaining URLs for today
      const urlsRemainingMonth = Math.max(monthlyLimit - url_count_month, 0);  // Remaining URLs for the month

      res.json({
        planName: name,
        urlLimit: monthlyLimit,  // Monthly URL limit
        dailyUrlLimit: dailyLimit,  // Daily URL limit
        urlsRemainingToday,  // Remaining URLs for today
        urlsRemainingMonth,  // Remaining URLs for the month
        activationDate: activation_date,
        expirationDate: expiration_date,
        daysRemaining
      });
    }
  );
});


app.get('/api/plans', (req, res) => {
  db.query('SELECT * FROM membership_plans', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching plans', error: err });
    }
    res.json(results);
  });
});


// Get original URL and redirect
app.get('/api/redirect/:shortUrl', (req, res) => {
  const { shortUrl } = req.params;

  db.query('SELECT original_url FROM urls WHERE shortened_url = ?', [shortUrl], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'URL not found' });
    }

    const originalUrl = results[0].original_url;
    res.json({ originalUrl });
  });
});

// Get all urls
app.get('/api/urls', authenticateToken, (req, res) => {
  db.query('SELECT * FROM urls WHERE user_id = ?', [req.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching plans', error: err });
    }
    res.json(results);
  });
});

// Razorpay payment order creation
app.post('/api/create-order',authenticateToken, (req, res) => {
  const { amount, user_id } = req.body; // Include user_id from the request body
  const options = {
    amount: amount * 100, // amount in paise
    currency: 'INR',
    receipt: 'order_rcptid_11',
  };

  razorpay.orders.create(options, (err, order) => {
    if (err) {
      return res.status(500).json({ message: 'Error creating Razorpay order' });
    }

    // Store payment details in the database
    const paymentData = {
      payment_id: order.id,
      user_id: user_id,  // Store the user_id
      amount: amount,
      payment_status: 'pending',  // Initially, the payment status is 'pending'
      created_at: new Date(),
    };

    db.query(
      'INSERT INTO payments (payment_id, order_id, user_id, amount, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [paymentData.payment_id, paymentData.payment_id, req.userId, paymentData.amount, paymentData.payment_status, paymentData.created_at],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error saving payment details to database', error: err });
        }
        res.json({ order_id: order.id, amount: order.amount / 100 });
      }
    );
  });
});

// Razorpay payment verification
app.post('/api/verify-payment', authenticateToken, (req, res) => {
  const { paymentId, orderId, signature, planId, daysActive } = req.body;
  const body = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (generatedSignature === signature) {
    const userId = req.userId;  // Ensure the user is authenticated

    // Calculate activation and expiration dates
    const activationDate = new Date();
    const expirationDate = new Date();
    expirationDate.setDate(activationDate.getDate() + daysActive);  // Use daysActive from the request

    // Check if there's an existing active plan or expired plan for the user
    db.query(
      'SELECT * FROM active_plans WHERE user_id = ?',
      [userId],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error checking active plan', error: err });
        }

        if (result.length > 0) {
          // If there's an active plan, check if it has expired
          const activePlan = result[0];
          if (new Date(activePlan.expiration_date) <= new Date()) {
            // If the plan has expired, update the existing record with new plan details
            db.query(
              'UPDATE active_plans SET plan_id = ?, activation_date = ?, expiration_date = ? WHERE user_id = ?',
              [planId, activationDate, expirationDate, userId],
              (err) => {
                if (err) {
                  return res.status(500).json({ message: 'Error updating expired active plan', error: err });
                }

                // Store payment details in the payment history table
                const paymentStatus = 'success';
                const createdAt = new Date();
                db.query(
                  'UPDATE payments SET payment_id = ?, user_id = ?, amount = ?, payment_status = ?, created_at = ? WHERE order_id = ?',
                  [paymentId, userId, req.body.amount, paymentStatus, createdAt, orderId],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ message: 'Error storing payment details', error: err });
                    }

                    // Return success message after updating expired plan and payment
                    res.json({ message: 'Payment verified and plan renewed successfully' });
                  }
                );
              }
            );
          } else {
            // If the plan is still active, just update the plan details
            db.query(
              'UPDATE active_plans SET plan_id = ?, activation_date = ?, expiration_date = ? WHERE user_id = ?',
              [planId, activationDate, expirationDate, userId],
              (err) => {
                if (err) {
                  return res.status(500).json({ message: 'Error updating active plan', error: err });
                }

                // Store payment details in the payment history table
                const paymentStatus = 'success';
                const createdAt = new Date();
                db.query(
                  'UPDATE payments SET payment_id = ?, user_id = ?, amount = ?, payment_status = ?, created_at = ? WHERE order_id = ?',
                  [paymentId, userId, req.body.amount, paymentStatus, createdAt, orderId],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ message: 'Error storing payment details', error: err });
                    }

                    // Return success message after updating active plan and payment
                    res.json({ message: 'Payment verified and plan upgraded successfully' });
                  }
                );
              }
            );
          }
        } else {
          // If no active plan exists, insert a new one
          db.query(
            'INSERT INTO active_plans (user_id, plan_id, activation_date, days_active, expiration_date) VALUES (?, ?, ?, ?, ?)',
            [userId, planId, activationDate, daysActive, expirationDate],
            (err) => {
              if (err) {
                return res.status(500).json({ message: 'Error storing active plan details', error: err });
              }

              // Store payment details in the payment history table
              const paymentStatus = 'success';
              const createdAt = new Date();
              db.query(
                'UPDATE payments SET payment_id = ?, user_id = ?, amount = ?, payment_status = ?, created_at = ? WHERE order_id = ?',
                [paymentId, userId, req.body.amount, paymentStatus, createdAt, orderId],
                (err) => {
                  if (err) {
                    return res.status(500).json({ message: 'Error storing payment details', error: err });
                  }

                  // Return success message after inserting new active plan and payment
                  res.json({ message: 'Payment verified and plan upgraded successfully' });
                }
              );
            }
          );
        }
      }
    );
  } else {
    res.status(400).json({ message: 'Payment verification failed' });
  }
});

app.get('/api/meta-data', async (req, res) => {
  const { url } = req.query;
  
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const metaData = {
      title: $('meta[property="og:title"]').attr('content') || 'Default Title',
      description: $('meta[property="og:description"]').attr('content') || 'Default Description',
      image: $('meta[property="og:image"]').attr('content') || 'default-image-url',
    };
    
    res.json(metaData);
  } catch (error) {
    console.error('Error fetching meta data', error);
    res.status(500).json({});
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
