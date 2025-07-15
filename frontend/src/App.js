import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState('Paris');
  const [selectedSeason, setSelectedSeason] = useState('Automne');

  // Prix de base par région et saison (données d'exemple)
  const basePrices = {
    'Paris': { 'Printemps': 1.2, 'Été': 1.0, 'Automne': 1.1, 'Hiver': 1.3 },
    'Lyon': { 'Printemps': 1.1, 'Été': 0.9, 'Automne': 1.0, 'Hiver': 1.2 },
    'Marseille': { 'Printemps': 1.0, 'Été': 0.8, 'Automne': 0.9, 'Hiver': 1.1 },
    'Toulouse': { 'Printemps': 1.05, 'Été': 0.85, 'Automne': 0.95, 'Hiver': 1.15 }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    const newFiles = imageFiles.map((file, index) => ({
      id: Date.now() + index,
      file: file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      predictions: null,
      analyzed: false,
      error: null
    }));
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setBatchResults([]);
    setSelectedImageIndex(null);
    setError('');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const fakeEvent = { target: { files: imageFiles } };
      handleFileChange(fakeEvent);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
    if (selectedImageIndex !== null) {
      const updatedFiles = selectedFiles.filter(file => file.id !== fileId);
      if (selectedImageIndex >= updatedFiles.length) {
        setSelectedImageIndex(null);
      }
    }
  };

  const analyzeSingleImage = async (file) => {
    try {
      const response = await axios.post(
        'http://localhost:8080/image',
        file.file,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        }
      );
      return response.data.predictions;
    } catch (error) {
      throw new Error('Erreur lors de l\'analyse de l\'image');
    }
  };

  const calculatePrice = (predictions) => {
    if (!predictions || predictions.length === 0) return { basePrice: 0, finalPrice: 0, penalty: 0 };
    
    // Trouver le produit détecté (hors fresh/rotten)
    const productPredictions = predictions.filter(p => 
      p.tagName.toLowerCase() !== 'fresh' && p.tagName.toLowerCase() !== 'rotten'
    );
    
    if (productPredictions.length === 0) return { basePrice: 0, finalPrice: 0, penalty: 0 };
    
    const product = productPredictions[0];
    const basePrice = basePrices[selectedRegion][selectedSeason];
    
    // Calculer la pénalité basée sur la probabilité de pourriture
    const rottenPrediction = predictions.find(p => p.tagName.toLowerCase() === 'rotten');
    const rottenProbability = rottenPrediction ? rottenPrediction.probability : 0;
    const penalty = rottenProbability;
    const finalPrice = basePrice * (1 - penalty);
    
    return {
      basePrice,
      finalPrice: Math.max(0, finalPrice),
      penalty,
      product: product.tagName
    };
  };

  const handleBatchAnalysis = async () => {
    if (selectedFiles.length === 0) {
      setError('Veuillez sélectionner au moins une image.');
      return;
    }
    
    setError('');
    setLoading(true);
    setAnalysisProgress(0);
    
    const results = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      try {
        const predictions = await analyzeSingleImage(file);
        const priceInfo = calculatePrice(predictions);
        
        results.push({
          ...file,
          predictions,
          analyzed: true,
          error: null,
          priceInfo
        });
        
        setAnalysisProgress(((i + 1) / selectedFiles.length) * 100);
        
      } catch (error) {
        results.push({
          ...file,
          predictions: null,
          analyzed: false,
          error: error.message
        });
      }
    }
    
    setBatchResults(results);
    setLoading(false);
    setAnalysisProgress(100);
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setBatchResults([]);
    setSelectedImageIndex(null);
    setError('');
    setAnalysisProgress(0);
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
    if (!predictions || predictions.length === 0) return 'Inconnu';
    
    // Filter out fresh and rotten predictions
    const productPredictions = predictions.filter(p => 
      p.tagName.toLowerCase() !== 'fresh' && p.tagName.toLowerCase() !== 'rotten'
    );
    
    if (productPredictions.length === 0) return 'Inconnu';
    
    // Find the prediction with the highest probability
    const highestPrediction = productPredictions.reduce((max, current) => 
      current.probability > max.probability ? current : max
    );
    
    return highestPrediction.tagName;
  };

  const getTotalLoss = () => {
    if (batchResults.length === 0) return 0;
    
    return batchResults.reduce((total, result) => {
      if (result.priceInfo) {
        return total + (result.priceInfo.basePrice - result.priceInfo.finalPrice);
      }
      return total;
    }, 0);
  };

  const getSelectedImageData = () => {
    if (selectedImageIndex === null || batchResults.length === 0) return null;
    return batchResults[selectedImageIndex];
  };

  const selectedImageData = getSelectedImageData();

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🍎 Plateforme de Gestion de Stock - Fruits & Légumes</h1>
        <p>Analysez vos lots de produits pour optimiser votre gestion des pertes</p>
      </header>

      <main className="main-content">
        {/* Configuration */}
        <div className="config-section">
          <h2>Configuration de l'analyse</h2>
          <div className="config-grid">
            <div className="config-item">
              <label>Région:</label>
              <select 
                value={selectedRegion} 
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                <option value="Paris">Paris</option>
                <option value="Lyon">Lyon</option>
                <option value="Marseille">Marseille</option>
                <option value="Toulouse">Toulouse</option>
              </select>
            </div>
            <div className="config-item">
              <label>Saison:</label>
              <select 
                value={selectedSeason} 
                onChange={(e) => setSelectedSeason(e.target.value)}
              >
                <option value="Printemps">Printemps</option>
                <option value="Été">Été</option>
                <option value="Automne">Automne</option>
                <option value="Hiver">Hiver</option>
              </select>
            </div>
          </div>
        </div>

        {/* Zone d'upload */}
        <div className="upload-section">
          <div 
            className="upload-area batch-upload"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input
              id="fileInput"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            <div className="upload-placeholder">
              <div className="upload-icon">📤</div>
              <p>Cliquez pour sélectionner des images</p>
              <p className="upload-subtitle">ou glissez-déposez vos fichiers ici</p>
              <span className="file-types">JPG, PNG, GIF acceptés • Sélection multiple</span>
            </div>
          </div>
        </div>

        {/* Aperçu des images sélectionnées */}
        {selectedFiles.length > 0 && (
          <div className="images-preview-section">
            <h2>Images sélectionnées ({selectedFiles.length})</h2>
            <div className="images-grid">
              {selectedFiles.map((file, index) => (
                <div 
                  key={file.id} 
                  className={`image-thumbnail ${selectedImageIndex === index ? 'selected' : ''}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img src={file.preview} alt={file.name} />
                  <div className="thumbnail-overlay">
                    <button 
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="thumbnail-info">
                    <span className="file-name">{file.name}</span>
                    {batchResults.length > 0 && batchResults[index] && (
                      <span className={`analysis-status ${batchResults[index].analyzed ? 'analyzed' : 'error'}`}>
                        {batchResults[index].analyzed ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="action-buttons">
          <button 
            className="predict-btn batch-analyze"
            onClick={handleBatchAnalysis}
            disabled={selectedFiles.length === 0 || loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Analyse en cours... ({Math.round(analysisProgress)}%)
              </>
            ) : (
              <>
                Analyser le lot ({selectedFiles.length} images)
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

        {/* Barre de progression */}
        {loading && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
        )}

        {/* Messages d'erreur */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Résultats du batch */}
        {batchResults.length > 0 && (
          <div className="batch-results-section">
            <h2>Résultats de l'analyse du lot</h2>
            
            {/* Résumé financier */}
            <div className="financial-summary">
              <div className="summary-card">
                <h3>Résumé Financier</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total des images:</span>
                    <span className="summary-value">{batchResults.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Images analysées:</span>
                    <span className="summary-value">
                      {batchResults.filter(r => r.analyzed).length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Perte totale estimée:</span>
                    <span className="summary-value loss">
                      {getTotalLoss().toFixed(2)}€
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Région:</span>
                    <span className="summary-value">{selectedRegion}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Saison:</span>
                    <span className="summary-value">{selectedSeason}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Détail de l'image sélectionnée */}
            {selectedImageData && (
              <div className="selected-image-detail">
                <h3>Détail de l'analyse - {selectedImageData.name}</h3>
                
                {selectedImageData.analyzed ? (
                  <div className="detail-content">
                    <div className="detail-image">
                      <img src={selectedImageData.preview} alt={selectedImageData.name} />
                    </div>
                    
                    <div className="detail-info">
                      {/* Statut de fraîcheur */}
                      {(() => {
                        const status = getPredictionStatus(selectedImageData.predictions);
                        return status && (
                          <div className={`status-card ${status.status}`}>
                            <h4>
                              {status.status === 'fresh' ? 'Produit Frais' :
                               status.status === 'rotten' ? 'Produit Détérioré' :
                               'Résultat Incertain'}
                            </h4>
                            <p>Confiance: {(status.confidence * 100).toFixed(2)}%</p>
                          </div>
                        );
                      })()}
                      
                      {/* Informations de prix */}
                      {selectedImageData.priceInfo && (
                        <div className="price-info">
                          <h4>Informations de Prix</h4>
                          <div className="price-details">
                            <p><strong>Produit détecté:</strong> {getPredictionName(selectedImageData.predictions)}</p>
                            <p><strong>Prix de base:</strong> {selectedImageData.priceInfo.basePrice.toFixed(2)}€</p>
                            <p><strong>Prix final:</strong> {selectedImageData.priceInfo.finalPrice.toFixed(2)}€</p>
                            <p><strong>Pénalité:</strong> {(selectedImageData.priceInfo.penalty * 100).toFixed(2)}%</p>
                            <p><strong>Perte:</strong> {(selectedImageData.priceInfo.basePrice - selectedImageData.priceInfo.finalPrice).toFixed(2)}€</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Prédictions détaillées */}
                      <div className="predictions-details">
                        <h4>Prédictions détaillées</h4>
                        <div className="predictions-list">
                          {selectedImageData.predictions.map((prediction, index) => (
                            <div key={index} className="prediction-item">
                              <span className="prediction-name">{prediction.tagName}</span>
                              <span className="prediction-probability">
                                {(prediction.probability * 100).toFixed(2)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="error-detail">
                    <p>Erreur lors de l'analyse: {selectedImageData.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
