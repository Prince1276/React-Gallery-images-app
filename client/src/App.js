import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Gallery from 'react-image-gallery';
import Modal from 'react-modal';

import './App.css'; // Import the CSS file

Modal.setAppElement('#root'); // Set the root element as the app element for modal accessibility

function App() {
  const [file, setFile] = useState(null);
  const [images, setImages] = useState([]);
  const ws = new WebSocket('ws://localhost:5000'); // Replace with your server URL

  ws.onmessage = (event) => {
    if (event.data === 'image_uploaded') {
      // Fetch and update the images when a new image is uploaded
      fetchImages();
    }
  };

  const [viewerIsOpen, setViewerIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  const [modalIsOpen, setModalIsOpen] = useState(false); // State to control the modal

  const fetchImages = async () => {
    try {
      const response = await axios.get('/images');
      setImages(
        response.data.map((image) => ({
          original: `uploads/${image.filename}`,
          thumbnail: `uploads/${image.filename}`,
          description: `Original Name: ${image.originalname}\nMIME Type: ${image.mimetype}\nFile Size: ${image.size} bytes`,
          id: image.id, // Added ID to identify images
        }))
      );
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  useEffect(() => {
    // Fetch the list of uploaded images from the backend when the component loads
    fetchImages();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Add the uploaded image to the displayed list of images
      setImages((prevImages) => [
        ...prevImages,
        {
          original: `uploads/${response.data.image.filename}`,
          thumbnail: `uploads/${response.data.image.filename}`,
          description: `Original Name: ${response.data.image.originalname}\nMIME Type: ${response.data.image.mimetype}\nFile Size: ${response.data.image.size} bytes`,
          id: response.data.image.id, // Added ID to identify images
        },
      ]);
      setFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleImageClick = (index) => {
    // Open the modal when an image is clicked
    setCurrentImage(index);
    setModalIsOpen(true);
  };

  const handleImageDelete = async (id) => {
    try {
      await axios.delete(`/images/${id}`);
      // Remove the image from the list
      const updatedImages = images.filter((image) => image.id !== id);
      setImages(updatedImages);
    } catch (error) {
      console.error('Deletion failed:', error);
    }
  };

  return (
    <div>
    <div className="header">
      <h1>Image Upload</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>

    {images.length > 0 && (
      <div>
        <h2>Uploaded Images:</h2>
        <div className="image-grid">
          {images.map((image, index) => (
            <div key={image.id} className="image-item">
              <div className="image-card" onClick={() => handleImageClick(index)}>
                <img
                  src={image.thumbnail}
                  alt={image.description}
                />
                <button className="delete-button" onClick={() => handleImageDelete(image.id)}>
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <Modal
      isOpen={modalIsOpen}
      onRequestClose={() => setModalIsOpen(false)}
      className="modal-content"
      overlayClassName="modal-overlay"
    >
      <Gallery
        items={images}
        currentIndex={currentImage}
        onClose={() => setModalIsOpen(false)}
      />
    </Modal>
  </div>
);
}

export default App;
