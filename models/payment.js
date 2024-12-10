// models/payment.js (assuming you're using Sequelize)
module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define('Payment', {
      payment_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      user_id: {
        type: DataTypes.STRING, // or INTEGER, based on your setup
        allowNull: false
      },
      amount: {
        type: DataTypes.INTEGER, // Store amount in paise for precision
        allowNull: false
      },
      payment_status: {
        type: DataTypes.STRING,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });
  
    return Payment;
  };
  