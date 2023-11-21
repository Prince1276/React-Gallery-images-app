const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const pg = require('pg');
const { Client } = pg;
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Create a connection to your PostgreSQL database
const db = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '1234',
    port: 5432,
});
db.connect();

// Create a storage engine using multer
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  },
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Create a table for images if it doesn't exist
db.query(`
  CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    originalname VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size INT NOT NULL
  );
`);

// Define a route for image uploads
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Insert image information into the database
    const imageInfo = {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
    const insertQuery = `
      INSERT INTO images (filename, originalname, mimetype, size)
      VALUES ($1, $2, $3, $4)
      RETURNING id, filename, originalname, mimetype, size
    `;

    const { rows } = await db.query(insertQuery, [
      imageInfo.filename,
      imageInfo.originalname,
      imageInfo.mimetype,
      imageInfo.size,
    ]);

    // Emit a WebSocket event to notify clients about the new image
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('image_uploaded');
      }
    });

    res.json({ message: 'File uploaded successfully', image: rows[0] });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Define a route to fetch all images
app.get('/images', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM images');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ message: 'Error fetching images' });
  }
});

// Define a route to update an image record
app.put('/images/:id', async (req, res) => {
  const id = req.params.id;
  const { newOriginalName } = req.body;
  try {
    const updateQuery = 'UPDATE images SET originalname = $1 WHERE id = $2';
    await db.query(updateQuery, [newOriginalName, id]);
    res.json({ message: 'Image record updated successfully' });
  } catch (error) {
    console.error('Error updating image record:', error);
    res.status(500).json({ message: 'Error updating image record' });
  }
});

// Define a route to delete an image record
app.delete('/images/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const deleteQuery = 'DELETE FROM images WHERE id = $1';
    await db.query(deleteQuery, [id]);
    res.json({ message: 'Image record deleted successfully' });
  } catch (error) {
    console.error('Error deleting image record:', error);
    res.status(500).json({ message: 'Error deleting image record' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
