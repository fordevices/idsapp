/**
 * ISC License
 * 
 * Copyright (c) 2025, Kirahi LLC
 * Max Seenisamy kirahi.com
 * 
 * Express.js server for Intrusion Detection System (IDS)
 */

import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, databasePath } from './js/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || config.SERVER_PORT;

// Database connection state
let db = null;
let isDatabaseConnected = false;
// Database path is now loaded from configuration
const DB_PATH = databasePath;

// Log configuration on startup
console.log('=== Intrusion Detection System (IDS) Configuration ===');
console.log('Database Path:', DB_PATH);
console.log('Server Port:', port);
console.log('====================================================='); 

// Connect to database
function connectToDatabase(callback) {
  if (db) {
    db.close();
  }
  
  try {
    // Connect to the standard SQLite database
    db = new Database(DB_PATH);
    
    // Test the connection by running a simple query
    const result = db.prepare("SELECT 1 as test").get();
    
    if (result) {
      isDatabaseConnected = true;
      console.log('Successfully connected to database');
      callback(null);
    } else {
      console.error('Database connection test failed');
      callback(new Error('Database connection test failed'));
    }
  } catch (error) {
    console.error('Database connection error:', error.message);
    return callback(error);
  }
}

app.use(express.json());

// Static file serving - serve all static assets first
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/public', express.static(path.join(__dirname, 'public')));


// Serve suppress.html directly from public directory
app.get('/suppress.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'suppress.html'));
});

// Database connection middleware
function requireDatabaseConnection(req, res, next) {
  if (!isDatabaseConnected) {
    try {
      connectToDatabase((err) => {
        if (err) {
          console.error('Database connection failed:', err.message);
          return res.status(500).json({ error: 'Database connection failed' });
        }
        console.log('Database connection successful');
        next();
      });
    } catch (error) {
      console.error('Connection error:', error.message);
      return res.status(500).json({ error: 'Database connection error' });
    }
    return;
  }
  
  next();
}


// Database info endpoint
app.get('/api/database-info', (req, res) => {
  try {
    const dbInfo = {
      name: path.basename(DB_PATH),
      fullPath: DB_PATH,
      isConnected: isDatabaseConnected
    };
    res.json(dbInfo);
  } catch (error) {
    console.error('Error getting database info:', error);
    res.status(500).json({ error: 'Failed to get database info' });
  }
});


// REST APIs for the App
// Start of Dynamic CRUD API - added by Cursor

// Utility: metadata cache and helpers for dynamic table CRUD
const metadataCache = new Map(); // tableName -> { columns: string[], primaryKey: string|null }

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getTableMetadata(tableName, callback) {
  if (!tableName) return callback(new Error('Table name is required'));
  if (metadataCache.has(tableName)) return callback(null, metadataCache.get(tableName));

  try {
    // Verify table exists
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
    const row = stmt.get(tableName);
    
    if (!row) return callback(new Error(`Table not found: ${tableName}`));

    // Introspect columns and primary key
    const pragmaSql = `PRAGMA table_info(${quoteIdentifier(tableName)})`;
    const rows = db.prepare(pragmaSql).all();
    
    if (!rows || rows.length === 0) return callback(new Error(`No columns found for ${tableName}`));
    
    const columns = rows.map((r) => r.name);
    const pkRow = rows.find((r) => r.pk === 1) || rows.find((r) => r.pk > 0);
    const primaryKey = pkRow ? pkRow.name : (columns.includes('id') ? 'id' : null);
    const meta = { columns, primaryKey };
    metadataCache.set(tableName, meta);
    callback(null, meta);
  } catch (error) {
    callback(error);
  }
}

// Metadata endpoint for client consumption
app.get('/api/:table/meta', requireDatabaseConnection, (req, res) => {
  const { table } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    res.send(meta);
  });
});

// Generic dynamic CRUD API
// List rows with pagination support and optional label filtering
app.get('/api/:table', requireDatabaseConnection, (req, res) => {
  const { table } = req.params;
  const { limit = 25, offset = 0, label } = req.query;
  
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    
    try {
      const orderBy = meta.primaryKey ? ` ORDER BY ${quoteIdentifier(meta.primaryKey)} DESC` : '';
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      
      // Build WHERE clause for label filtering if specified
      let whereClause = '';
      let countParams = [];
      let selectParams = [];
      
      if (label !== undefined && meta.columns.includes('Label')) {
        whereClause = ' WHERE Label = ?';
        const labelValue = parseInt(label, 10);
        countParams = [labelValue];
        selectParams = [labelValue];
      }
      
      // Get total count for pagination info
      const countSql = `SELECT COUNT(*) as total FROM ${quoteIdentifier(table)}${whereClause}`;
      const countResult = db.prepare(countSql).get(...countParams);
      const total = countResult.total;
      
      // Get paginated rows
      const sql = `SELECT * FROM ${quoteIdentifier(table)}${whereClause}${orderBy} LIMIT ? OFFSET ?`;
      const rows = db.prepare(sql).all(...selectParams, limitNum, offsetNum);
      
      res.send({
        data: rows || [],
        pagination: {
          total: total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (offsetNum + limitNum) < total
        }
      });
    } catch (error) {
      res.status(500).send('Internal server error');
    }
  });
});

// Get one by primary key or composite key
app.get('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    
    try {
      let sql, row;
      
      if (meta.primaryKey) {
        // Use primary key if available
        sql = `SELECT * FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(meta.primaryKey)} = ?`;
        row = db.prepare(sql).get(id);
      } else {
        // For tables without primary key, use composite key (Time + ID)
        // The id parameter should be in format "Time|ID"
        const [time, canId] = id.split('|');
        if (!time || !canId) {
          return res.status(400).send('Invalid composite key format. Expected "Time|ID"');
        }
        sql = `SELECT * FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier('Time')} = ? AND ${quoteIdentifier('ID')} = ?`;
        row = db.prepare(sql).get(time, canId);
      }
      
      if (!row) return res.status(404).send('Item not found');
      res.send(row);
    } catch (error) {
      res.status(500).send('Internal server error');
    }
  });
});

// Create
app.post('/api/:table', requireDatabaseConnection, (req, res) => {
  const { table } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    const insertable = meta.primaryKey ? meta.columns.filter((c) => c !== meta.primaryKey) : meta.columns;
    const keys = insertable.filter((c) => Object.prototype.hasOwnProperty.call(req.body, c));
    if (keys.length === 0) return res.status(400).send('No valid columns provided in request body');
    
    // Auto-populate timestamp fields for new records
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    const datetimeStr = now.toISOString(); // Full ISO datetime
    
    const autoFields = {};
    if (meta.columns.includes('createdon') && !keys.includes('createdon')) {
      autoFields.createdon = dateStr;
    }
    if (meta.columns.includes('modifiedon') && !keys.includes('modifiedon')) {
      autoFields.modifiedon = dateStr;
    }
    if (meta.columns.includes('modifiedtime') && !keys.includes('modifiedtime')) {
      autoFields.modifiedtime = timeStr;
    }
    
    // Add auto fields to keys and values
    const allKeys = [...keys, ...Object.keys(autoFields)];
    const allValues = [...keys.map((k) => req.body[k]), ...Object.values(autoFields)];
    
    const columnClause = allKeys.map(quoteIdentifier).join(', ');
    const placeholders = allKeys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${quoteIdentifier(table)} (${columnClause}) VALUES (${placeholders})`;
    
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...allValues);
      const response = Object.fromEntries(allKeys.map((k, i) => [k, allValues[i]]));
      if (meta.primaryKey) response[meta.primaryKey] = result.lastInsertRowid;
      res.status(201).send(response);
    } catch (runErr) {
      console.error('Database error:', runErr);
      console.error('SQL:', sql);
      console.error('Values:', allValues);
      res.status(500).send(`Internal server error: ${runErr.message}`);
    }
  });
});

// Update
app.put('/api/:table/:id', requireDatabaseConnection, (req, res) => {
  const { table, id } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    
    let updatable, whereClause, whereParams;
    
    if (meta.primaryKey) {
      // Use primary key if available
      updatable = meta.columns.filter((c) => c !== meta.primaryKey);
      whereClause = `${quoteIdentifier(meta.primaryKey)} = ?`;
      whereParams = [id];
    } else {
      // For tables without primary key, use composite key (Time + ID)
      const [time, canId] = id.split('|');
      if (!time || !canId) {
        return res.status(400).send('Invalid composite key format. Expected "Time|ID"');
      }
      updatable = meta.columns.filter((c) => c !== 'Time' && c !== 'ID');
      whereClause = `${quoteIdentifier('Time')} = ? AND ${quoteIdentifier('ID')} = ?`;
      whereParams = [time, canId];
    }
    
    const keys = updatable.filter((c) => Object.prototype.hasOwnProperty.call(req.body, c));
    if (keys.length === 0) return res.status(400).send('No updatable columns provided in request body');
    
    // Auto-update modified timestamp fields
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    
    const autoFields = {};
    if (meta.columns.includes('modifiedon') && !keys.includes('modifiedon')) {
      autoFields.modifiedon = dateStr;
    }
    if (meta.columns.includes('modifiedtime') && !keys.includes('modifiedtime')) {
      autoFields.modifiedtime = timeStr;
    }
    
    // Add auto fields to keys and values
    const allKeys = [...keys, ...Object.keys(autoFields)];
    const allValues = [...keys.map((k) => req.body[k]), ...Object.values(autoFields)];
    
    const setClause = allKeys.map((c) => `${quoteIdentifier(c)} = ?`).join(', ');
    const sql = `UPDATE ${quoteIdentifier(table)} SET ${setClause} WHERE ${whereClause}`;
    
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...allValues, ...whereParams);
      if (result.changes === 0) return res.status(404).send('Item not found');
      const response = Object.fromEntries(allKeys.map((k, i) => [k, allValues[i]]));
      if (meta.primaryKey) {
        response[meta.primaryKey] = id;
      } else {
        // For composite key, add both Time and ID to response
        const [time, canId] = id.split('|');
        response.Time = time;
        response.ID = canId;
      }
      res.status(200).send(response);
    } catch (runErr) {
      console.error('Database error:', runErr);
      console.error('SQL:', sql);
      console.error('Values:', [...allValues, ...whereParams]);
      res.status(500).send(`Internal server error: ${runErr.message}`);
    }
  });
});

// Delete
app.delete('/api/:table/:id', requireDatabaseConnection, (req, res) => {
  const { table, id } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    
    let sql, params;
    
    if (meta.primaryKey) {
      // Use primary key if available
      sql = `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(meta.primaryKey)} = ?`;
      params = [id];
    } else {
      // For tables without primary key, use composite key (Time + ID)
      const [time, canId] = id.split('|');
      if (!time || !canId) {
        return res.status(400).send('Invalid composite key format. Expected "Time|ID"');
      }
      sql = `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier('Time')} = ? AND ${quoteIdentifier('ID')} = ?`;
      params = [time, canId];
    }
    
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      if (result.changes === 0) return res.status(404).send('Item not found');
      res.status(204).send();
    } catch (runErr) {
      res.status(500).send('Internal server error');
    }
  });
});

// Search across all columns
app.get('/api/:table/search/:q', requireDatabaseConnection, (req, res) => {
  const { table, q } = req.params;
  getTableMetadata(table, (err, meta) => {
    if (err) return res.status(400).send(err.message);
    const like = `%${q}%`;
    const where = meta.columns.map((c) => `CAST(${quoteIdentifier(c)} AS TEXT) LIKE ?`).join(' OR ');
    const sql = `SELECT * FROM ${quoteIdentifier(table)} WHERE ${where}`;
    const params = meta.columns.map(() => like);
    
    try {
      const rows = db.prepare(sql).all(...params);
      res.send(rows || []);
    } catch (qErr) {
      res.status(500).send('Internal server error');
    }
  });
});

//End of Dynamic CRUD API - added by Cursor

// Handle .mjs files with proper MIME type
app.get('*.mjs', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  // If the request is for a .mjs file in the root, redirect to /js/ directory
  if (req.path.startsWith('/') && req.path.endsWith('.mjs') && !req.path.startsWith('/js/')) {
    const filename = req.path.substring(1); // Remove leading slash
    // Handle legacy itemmgmtapp.mjs requests
    if (filename === 'itemmgmtapp.mjs') {
      return res.redirect('/js/canmgmtapp.mjs');
    }
    return res.redirect(`/js/${filename}`);
  }
  res.sendFile(path.join(__dirname, req.path));
});

// Main application route - requires database connection
app.get('/', requireDatabaseConnection, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle all other routes by serving the index.html file (SPA) - requires database connection
app.get('*', requireDatabaseConnection, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Start the server
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}.`);
});

// Graceful shutdown
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('Already shutting down...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down server gracefully...`);
  
  // Close the HTTP server first
  server.close(() => {
    console.log('HTTP server closed.');
    
    
    // Then close the database
    if (db) {
      try {
        db.close();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing database:', err.message);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('Server shutdown complete.');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('Forcing shutdown...');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));