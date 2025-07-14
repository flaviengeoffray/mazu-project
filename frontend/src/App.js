import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Créer un aperçu de l'image
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Réinitialiser les états
      setPredictions(null);
      setError('');
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = { target: { files: [file] } };
      handleFileChange(fakeEvent);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Veuillez sélectionner une image.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await axios.post(
        'http://localhost:8080/image',
        selectedFile,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      setPredictions(response.data.predictions);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'upload ou de la prédiction de l\'image.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setPredictions(null);
    setError('');
  };

  const getPredictionStatus = (predictions) => {
    if (!predictions || predictions.length === 0) return null;
    
    const freshPrediction = predictions.find(p => p.tagName.toLowerCase() === 'fresh');
    const rottenPrediction = predictions.find(p => p.tagName.toLowerCase() === 'rotten');

    if (freshPrediction && freshPrediction.probability > 0.5) {
      return { status: 'fresh', confidence: freshPrediction.probability };
    } else if (rottenPrediction && rottenPrediction.probability > 0.5) {
      return { status: 'rotten', confidence: rottenPrediction.probability };
    }
    return { status: 'uncertain', confidence: 0.5 };
  };

  const getPredictionName = (predictions) => {
    if (!predictions || predictions.length === 0) return 'Aucun produit détecté';

    // Filter out fresh and rotten predictions
    const otherPredictions = predictions.filter(p => 
      p.tagName.toLowerCase() !== 'fresh' && p.tagName.toLowerCase() !== 'rotten'
    );
    
    if (otherPredictions.length === 0) return 'Aucun produit détecté';
    
    // Find the prediction with the highest probability
    const bestPrediction = otherPredictions.reduce((max, current) => 
      current.probability > max.probability ? current : max
    );
    
    return bestPrediction.tagName;
  };

  const predictionStatus = getPredictionStatus(predictions);
  const predictionName = getPredictionName(predictions);
  const predictionNameProbability = predictions ? predictions.find(p => p.tagName === predictionName)?.probability || 0 : 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🍎 Classificateur Fruits & Légumes</h1>
        <p>Analysez vos fruits et légumes pour déterminer leur fraîcheur</p>
      </header>

      <main className="main-content">
        {/* Zone d'upload */}
        <div className="upload-section">
          <div 
            className={`upload-area ${selectedFile ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input
              id="fileInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            {!imagePreview ? (
              <div className="upload-placeholder">
                <div className="upload-icon">📤</div>
                <p>Cliquez pour sélectionner une image</p>
                <p className="upload-subtitle">ou glissez-déposez votre fichier ici</p>
                <span className="file-types">JPG, PNG, GIF acceptés</span>
              </div>
            ) : (
              <div className="image-preview-container">
                <img 
                  src={imagePreview} 
                  alt="Aperçu" 
                  className="image-preview"
                />
                <div className="image-overlay">
                  <button 
                    className="change-image-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('fileInput').click();
                    }}
                  >
                    Changer l'image
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Informations sur le fichier */}
          {selectedFile && (
            <div className="file-info">
              <p><strong>Fichier:</strong> {selectedFile.name}</p>
              <p><strong>Taille:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
              <p><strong>Type:</strong> {selectedFile.type}</p>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="action-buttons">
          <button 
            className="predict-btn"
            onClick={handleSubmit}
            disabled={!selectedFile || loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Analyse en cours...
              </>
            ) : (
              <>
                Analyser l'image
              </>
            )}
          </button>
          
          <button 
            className="reset-btn"
            onClick={resetAll}
            disabled={loading}
          >
            Réinitialiser
          </button>
        </div>

        {/* Messages d'erreur */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Résultats */}
        {predictions && (
          <div className="results-section">
            <h2>Résultats de l'analyse</h2>

            {/* Statut global */}
            {predictionStatus && (
              <div className={`status-card ${predictionStatus.status}`}>
              <div className="status-content">
                <h3>
                {predictionStatus.status === 'fresh' ? 'Produit Frais' :
                  predictionStatus.status === 'rotten' ? 'Produit Détérioré' :
                  'Résultat Incertain'}
                </h3>
                <p className="prediction-name">
                <strong>Produit détecté:</strong> {predictionName} avec une confiance de {predictionNameProbability ? (predictionNameProbability * 100).toFixed(2) : 0}%
                </p>
                <p>
                {predictionStatus.status === 'fresh' ? 
                  'Ce produit semble frais et peut être consommé.' :
                  predictionStatus.status === 'rotten' ?
                  'Ce produit semble détérioré. Évitez de le consommer.' :
                  'Les résultats ne sont pas concluants.'}
                </p>
                <div className="confidence-bar">
                <div className="confidence-label">
                  Confiance: {(predictionStatus.confidence * 100).toFixed(2)}%
                </div>
                <div className="confidence-progress">
                  <div 
                  className="confidence-fill"
                  style={{ width: `${predictionStatus.confidence * 100}%` }}
                  ></div>
                </div>
                </div>
              </div>
              </div>
            )}

            {/* Détails des prédictions */}
            <div className="predictions-details">
              <h3>Détails des prédictions</h3>
              <div className="predictions-grid">
                {predictions.map((prediction, index) => {
                  const percentage = (prediction.probability * 100).toFixed(2);
                  const isFresh = prediction.tagName.toLowerCase() === 'fresh';
                  
                  return (
                    <div key={index} className={`prediction-card`}>
                      <div className="prediction-header">
                        <span className="prediction-label">
                          {prediction.tagName}
                        </span>
                      </div>
                      
                      <div className="prediction-percentage">
                        {percentage}%
                      </div>
                      
                      <div className="prediction-bar">
                        <div 
                          className="prediction-fill"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
