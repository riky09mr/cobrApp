const createServiceError = (statusCode, message, extras = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extras);
  return error;
};

module.exports = { createServiceError };