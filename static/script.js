document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const previewBox = document.getElementById('previewBox');
  const fileName = document.getElementById('fileName');
  const submitBtn = document.getElementById('submitBtn');
  const removeBtn = document.getElementById('removeBtn');
  const loader = document.getElementById('loader');
  const resultsSection = document.getElementById('resultsSection');
  const imageModal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImg');
  const modalCaption = document.getElementById('modalCaption');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  let selectedFile = null;

  // Drag and Drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    previewBox.style.display = 'none';
    submitBtn.setAttribute('disabled', 'true');
  });

  submitBtn.addEventListener('click', handleUpload);

  function setFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    previewBox.style.display = 'flex';
    submitBtn.removeAttribute('disabled');
  }

  async function handleUpload() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    loader.style.display = 'block';
    resultsSection.style.display = 'none';
    submitBtn.setAttribute('disabled', 'true');

    loader.scrollIntoView({ behavior: 'smooth' });

    try {
      const response = await fetch('/verify-and-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Server analysis failed');
      }

      const data = await response.json();
      renderResults(data);
    } catch (err) {
      alert(`Error during processing: ${err.message}`);
    } finally {
      loader.style.display = 'none';
      submitBtn.removeAttribute('disabled');
    }
  }

  function renderResults(data) {
    resultsSection.style.display = 'block';

    const statusBanner = document.getElementById('statusBanner');
    const statusText = document.getElementById('statusText');
    const validityTag = document.getElementById('validityTag');

    if (data.status === 'SUCCESS' && data.is_valid_watershed_structure) {
      statusBanner.className = 'status-banner status-success';
      statusText.textContent = 'AUDIT PIPELINE COMPLETED: SUCCESS';
      validityTag.textContent = 'Structure Verified';
    } else {
      statusBanner.className = 'status-banner status-rejected';
      statusText.textContent = 'IMAGE REJECTED';
      validityTag.textContent = 'Non-Watershed Object';
    }

    const structuresContainer = document.getElementById('structuresContainer');
    structuresContainer.innerHTML = '';
    if (data.verification_details?.detected_structures?.length > 0) {
      data.verification_details.detected_structures.forEach((struct) => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = struct;
        structuresContainer.appendChild(span);
      });
    } else {
      structuresContainer.innerHTML = '<span class="tag">None Detected</span>';
    }

    document.getElementById('confScore').textContent = data.verification_details?.confidence_score
      ? `${(data.verification_details.confidence_score * 100).toFixed(1)}%`
      : '--';

    document.getElementById('reasoningText').textContent =
      data.verification_details?.reasoning || 'No details provided.';

    if (data.coordinates) {
      document.getElementById('coordDisplay').textContent = `${data.coordinates.latitude.toFixed(4)}°N, ${data.coordinates.longitude.toFixed(4)}°E`;
    } else {
      document.getElementById('coordDisplay').textContent = 'Coordinates not found';
    }

    const geeCard = document.getElementById('geeMetricsCard');
    if (data.gee_metrics && data.gee_metrics.metrics) {
      geeCard.style.display = 'block';
      const m = data.gee_metrics.metrics;

      const indicesToDisplay = [
        { key: 'ndvi', label: 'NDVI (Vegetation)' },
        { key: 'savi', label: 'SAVI (Soil-Adjusted)' },
        { key: 'evi', label: 'EVI (Enhanced Veg)' },
        { key: 'ndwi', label: 'NDWI (Water/Moisture)' },
        { key: 'mndwi', label: 'MNDWI (Open Water)' },
        { key: 'ndmi', label: 'NDMI (Canopy Moisture)' },
        { key: 'ndre', label: 'NDRE (Red Edge)' },
        { key: 'nmdi', label: 'NMDI (Drought Index)' },
      ];

      const statsGrid = document.getElementById('statsGrid');
      statsGrid.innerHTML = '';

      indicesToDisplay.forEach((item) => {
        const postVal = m[`post_${item.key}`] ?? '--';
        const preVal = m[`pre_${item.key}`] ?? '--';
        const deltaVal = m[`delta_${item.key}`] ?? 0;
        const isPos = deltaVal >= 0;

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
          <div class="stat-title">${item.label}</div>
          <div class="stat-num">${postVal}</div>
          <div class="stat-delta ${isPos ? 'delta-pos' : 'delta-neg'}">
            Δ ${isPos ? '+' : ''}${deltaVal} (from ${preVal})
          </div>
        `;
        statsGrid.appendChild(card);
      });

      if (data.gee_metrics.image_urls) {
        const u = data.gee_metrics.image_urls;
        document.getElementById('rgbImg').src = u.rgb_url || '';
        document.getElementById('ndviImg').src = u.ndvi_url || '';
        document.getElementById('saviImg').src = u.savi_url || '';
        document.getElementById('ndwiImg').src = u.ndwi_url || '';
        document.getElementById('mndwiImg').src = u.mndwi_url || '';
        document.getElementById('ndmiImg').src = u.ndmi_url || '';
      }
    } else {
      geeCard.style.display = 'none';
    }

    const evalBox = document.getElementById('evaluationText');
    let formattedText = data.final_evaluation || 'Evaluation not available.';
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    evalBox.innerHTML = `<p>${formattedText}</p>`;

    setTimeout(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Lightbox Modal
  window.openModal = function (imgElementId, captionText) {
    const el = document.getElementById(imgElementId);
    if (!el || !el.src || el.src.endsWith('#') || el.src === window.location.href) return;
    modalImg.src = el.src;
    modalCaption.textContent = captionText;
    imageModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  function closeModal() {
    imageModal.style.display = 'none';
    modalImg.src = '';
    modalCaption.textContent = '';
    document.body.style.overflow = 'auto';
  }

  imageModal.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.style.display === 'flex') {
      closeModal();
    }
  });
});
