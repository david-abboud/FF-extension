document.addEventListener('DOMContentLoaded', function () {
  fetch('features.json')
    .then(response => response.json())
    .then(data => {
      const checkboxGroup = document.getElementById('checkboxGroup');
      data.features.forEach(feature => {
        const checkboxRow = document.createElement('div');
        checkboxRow.className = 'popup_row';
        checkboxRow.innerHTML = `
          <div class="popup_checkbox">
            <input id="${feature.id}" type="checkbox" value="${feature.value}">
            <label for="${feature.id}"></label>
          </div>
          <div class="popup_pin-container">
            <label for="${feature.id}">${feature.label}</label>
            <button type="button" class="popup_pin-button" data-feature-id="${feature.id}">
              <span class="popup_pin-emoji">📌</span>
            </button>
          </div>
        `;
        checkboxGroup.appendChild(checkboxRow);
      });

      // Initialize checkboxes and other interactions
      initCheckboxes();
    })
    .catch(error => console.error('Error loading features:', error));

  function initCheckboxes() {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      console.error('Chrome extension environment not available.');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      // Combine URL features and stored features
      const url = new URL(tab.url);
      const urlFeatures = url.searchParams.get('features')?.split(',') || [];
      
      chrome.storage.local.get(tab.id.toString(), function(result) {
        const storedFeatures = result[tab.id.toString()]?.split(',') || [];
        const allFeatures = new Set([...urlFeatures, ...storedFeatures]);

        allFeatures.forEach(feature => {
          const checkbox = document.querySelector(`input[value="${feature}"]`);
          if (checkbox) checkbox.checked = true;
        });
      });

      setupPinnedItems();
      setupToggleAllButton();
      setupPinButtonListeners();
    });
  }

  function setupPinnedItems() {
    const checkboxGroup = document.getElementById("checkboxGroup");
    const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    pinnedItems.forEach(function (featureId) {
      const featureElement = document.querySelector(`#${featureId}`).closest(".popup_row");
      featureElement.classList.add("popup_row__pinned");
      checkboxGroup.insertBefore(featureElement, checkboxGroup.firstChild);
    });
  }

  function setupToggleAllButton() {
    document.getElementById('toggle-all').addEventListener('click', function () {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
      checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
    });
  }

  function setupPinButtonListeners() {
    document.getElementById("checkboxGroup").addEventListener("click", function (e) {
      const pinButton = e.target.closest(".popup_pin-button");
      if (!pinButton) return;

      const featureId = pinButton.getAttribute("data-feature-id");
      const featureElement = document.querySelector(`input#${featureId}`).closest(".popup_row");
      const isPinned = featureElement.classList.toggle("popup_row__pinned");

      if (isPinned) {
        this.insertBefore(featureElement, this.firstChild);
        addPinnedItem(featureId);
      } else {
        removePinnedItem(featureId);
      }
    });
  }

  function addPinnedItem(featureId) {
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    if (!pinnedItems.includes(featureId)) {
      pinnedItems.push(featureId);
    }
    localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
  }

  function removePinnedItem(featureId) {
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    pinnedItems = pinnedItems.filter(item => item !== featureId);
    localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
  }

  // Add the search functionality
  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    document.querySelectorAll('.popup_row').forEach(function (feature) {
      feature.style.display = feature.innerText.toLowerCase().includes(searchTerm) ? 'flex' : 'none';
    });
  });

  // Event listener for submitting the form
  document.getElementById('url-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const selectedOptions = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => checkbox.value);

    const featureFlags = selectedOptions.join(',');

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      // Store the feature flags in local storage
      chrome.storage.local.set({ [tab.id.toString()]: featureFlags }, function() {
        console.log('Stored Flags for Tab:', tab.id, featureFlags);
      });

      // Update the URL with the new feature flags
      let newUrl = new URL(tab.url);
      if (featureFlags) {
        newUrl.searchParams.set('features', featureFlags);
      } else {
        newUrl.searchParams.delete('features');
      }

      chrome.tabs.update(tab.id, { url: newUrl.toString() });
    });
  });
});