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
            <input id="${feature.id}" type="checkbox" value="${feature.value}" data-type="${feature.type}">
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
        const storedData = result[tab.id.toString()] || {};
        const storedLocalFeatures = storedData.localFeatureFlags?.split(',') || [];
        const storedProj05Features = Object.keys(storedData.proj05FeatureFlags || {});
        
        const allFeatures = new Set([...urlFeatures, ...storedLocalFeatures, ...storedProj05Features]);

        allFeatures.forEach(feature => {
          const checkbox = document.querySelector(`input[value="${feature}"]`);
          if (checkbox) checkbox.checked = true;
        });

        // Check proj05 features in the URL
        document.querySelectorAll('input[data-type="proj05"]').forEach(checkbox => {
          if (url.searchParams.get(checkbox.value) === 'true') {
            checkbox.checked = true;
          }
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
      .map(checkbox => ({
        value: checkbox.value,
        type: checkbox.dataset.type
      }));

    const localFeatureFlags = selectedOptions
      .filter(option => option.type === 'local')
      .map(option => option.value)
      .join(',');

    const proj05FeatureFlags = selectedOptions
      .filter(option => option.type === 'proj05')
      .reduce((acc, option) => {
        acc[option.value] = true;
        return acc;
      }, {});

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      // Store the feature flags in local storage
      chrome.storage.local.set({
        [tab.id.toString()]: {
          localFeatureFlags,
          proj05FeatureFlags
        }
      }, function() {
        console.log('Stored Flags for Tab:', tab.id, { localFeatureFlags, proj05FeatureFlags });
      });

      // Update the URL with the new feature flags
      let newUrl = new URL(tab.url);
      if (localFeatureFlags) {
        newUrl.searchParams.set('features', localFeatureFlags);
      } else {
        newUrl.searchParams.delete('features');
      }

      // Add proj05 feature flags
      Object.keys(proj05FeatureFlags).forEach(flag => {
        newUrl.searchParams.set(flag, 'true');
      });

      // Remove any proj05 flags that are no longer active
      document.querySelectorAll('input[data-type="proj05"]').forEach(checkbox => {
        if (!checkbox.checked) {
          newUrl.searchParams.delete(checkbox.value);
        }
      });

      chrome.tabs.update(tab.id, { url: newUrl.toString() });
    });
  });
});