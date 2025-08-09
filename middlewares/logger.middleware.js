import chalk from 'chalk';

// Express middleware to log requests with colored output
const requestLogger = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const ms = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
    const { method } = req;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;

    const statusColor = status >= 500
      ? chalk.red
      : status >= 400
      ? chalk.yellow
      : status >= 300
      ? chalk.cyan
      : chalk.green;

    const methodColor = {
      GET: chalk.blue,
      POST: chalk.green,
      PUT: chalk.yellow,
      PATCH: chalk.magenta,
      DELETE: chalk.red
    }[method] || chalk.white;

    console.log(
      [
        chalk.dim(new Date().toISOString()),
        methodColor(method),
        chalk.white(url),
        statusColor(status),
        chalk.dim(`${ms} ms`)
      ].join(' ')
    );
  });

  next();
};

export default requestLogger;
