import chalk from 'chalk';
import logger from '../utils/logger.js';

// 404 handler for unknown routes
const notFoundHandler = (req, res, next) => {
	res.status(404).json({
		success: false,
		message: 'Route not found',
		path: req.originalUrl || req.url
	});
};

// Centralized error handler
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
	const isProd = process.env.NODE_ENV === 'production';

	// Default error shape
	let statusCode = err.statusCode || 500;
	let message = err.message || 'Server Error';
	let details = undefined;

	// Mongoose: invalid ObjectId or cast issue
	if (err.name === 'CastError') {
		statusCode = 400;
		message = `Invalid value for ${err.path}`;
		details = { path: err.path, value: err.value };
	}

	// Mongoose: validation errors
	if (err.name === 'ValidationError') {
		statusCode = 400;
		message = 'Validation Error';
		details = Object.values(err.errors).map(e => e.message);
	}

	// Mongoose: duplicate key
	if (err.code === 11000) {
		statusCode = 400;
		const keys = Object.keys(err.keyPattern || err.keyValue || {});
		const field = keys[0] || 'field';
		message = `${field} already exists`;
		details = err.keyValue;
	}

	// JWT errors (if used in auth middleware)
	if (err.name === 'JsonWebTokenError') {
		statusCode = 401;
		message = 'Invalid token';
	}
	if (err.name === 'TokenExpiredError') {
		statusCode = 401;
		message = 'Token expired';
	}

	// If headers already sent, delegate to default Express handler
	if (res.headersSent) {
		return next(err);
	}

	// Log the error
	const statusColor = statusCode >= 500 ? chalk.red : statusCode >= 400 ? chalk.yellow : chalk.cyan;
	if (isProd) {
		logger.error({
			timestamp: new Date().toISOString(),
			statusCode,
			message,
			stack: err.stack,
			details
		});
	} else {
		console.error(
			[
				chalk.dim(new Date().toISOString()),
				statusColor(`${statusCode}`),
				chalk.white(message),
				!isProd && err.stack ? `\n${chalk.dim(err.stack)}` : ''
			].join(' ')
		);
	}

	// Send JSON response
	return res.status(statusCode).json({
		success: false,
		message,
		...(details ? { details } : {}),
		...(isProd ? {} : { stack: err.stack })
	});
};

export { notFoundHandler, errorHandler };
export default errorHandler;
