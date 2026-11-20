class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const DB_DOWN = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR', 'ECONNRESET'];

const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large. Pictures must be 2 MB or smaller.' });
  if (DB_DOWN.includes(err.code))
    return res.status(503).json({ error: 'The database is currently unavailable. Please try again shortly.' });
  if (err.code === 'ER_DUP_ENTRY')
    return res.status(409).json({ error: 'A record with the same unique value (name or phone) already exists' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2')
    return res.status(409).json({ error: 'This record is used by other records and cannot be deleted' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2')
    return res.status(400).json({ error: 'A referenced record (supplier, vendor or fruit) does not exist' });
  if (['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_CONSTRAINT_FAILED', 'ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE'].includes(err.code))
    return res.status(400).json({ error: 'One or more values are not allowed by the database rules' });
  console.error('[ERROR]', err);
  return res.status(500).json({ error: 'Unexpected server error' });
};

module.exports = { HttpError, notFound, errorHandler };
