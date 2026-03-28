const { sendContactEmail } = require("./emailService");

async function submitContactMessage({ name, email, message }) {
  await sendContactEmail({ name, email, message });

  return {
    success: true,
    message: "Message received. We will get back to you soon.",
  };
}

module.exports = {
  submitContactMessage,
};
