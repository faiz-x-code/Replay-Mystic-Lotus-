import serverless from 'serverless-http';
import app from '../../backend/dist/server.js';

export const handler = serverless(app);
