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
    // Ensure the chrome.tabs API is available
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (!tab || !tab.url) {
          console.error('No active tab or URL found.');
          return;
        }

        let url = new URL(tab.url);
        let params = url.searchParams;
        let features = params.get('features');
        if (features) {
          let featureList = features.split(',');
          featureList.forEach(feature => {
            let checkbox = document.querySelector(`input[value="${feature}"]`);
            if (checkbox) {
              checkbox.checked = true;
            }
          });
        }
      });

      const checkboxGroup = document.getElementById("checkboxGroup");

      const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
      pinnedItems.forEach(function (featureId) {
        const featureElement = document.querySelector(`#${featureId}`).closest(".popup_row");
        featureElement.classList.add("popup_row__pinned");
        checkboxGroup.insertBefore(featureElement, checkboxGroup.firstChild);
      });

      const toggleAllButton = document.getElementById('toggle-all');
      toggleAllButton.addEventListener('click', function () {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
        checkboxes.forEach(checkbox => {
          checkbox.checked = !allChecked;
        });
      });

      checkboxGroup.addEventListener("click", function (e) {
        let pinButton = e.target;
        if (e.target.tagName === 'SPAN') {
          pinButton = e.target.parentElement;
        }

        if (pinButton.classList.contains("popup_pin-button")) {
          const featureId = pinButton.getAttribute("data-feature-id");
          const featureElement = document.querySelector(`input#${featureId}`).closest(".popup_row");

          if (featureElement.classList.contains("popup_row__pinned")) {
            featureElement.classList.remove("popup_row__pinned");
            removePinnedItem(featureId);
          } else {
            featureElement.classList.add("popup_row__pinned");
            checkboxGroup.insertBefore(featureElement, checkboxGroup.firstChild);
            addPinnedItem(featureId);
          }
        }
      });

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
    }
  }

  // Add the search functionality
  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const features = document.querySelectorAll('.popup_row');
    features.forEach(function (feature) {
      const label = feature.innerText;
      if (label.includes(searchTerm)) {
        feature.style.display = 'flex'; // Show matching features
      } else {
        feature.style.display = 'none'; // Hide non-matching features
      }
    });
  });
});

document.getElementById('url-form').addEventListener('submit', function (event) {
  event.preventDefault();

  const selectedOptions = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);

  const featureFlags = selectedOptions.join(',');

  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      let newUrl = new URL(tab.url);
      let params = newUrl.searchParams;

      if (featureFlags) {
        params.set('features', featureFlags);
      } else {
        params.delete('features');
      }

      let paramsString = params.toString();

      if (paramsString === "") {
        // No other options after "?" -> remove the whole "?"
        newUrl.search = "";
      } else {
        // Remove "features=" if it’s the only parameter
        newUrl.search = paramsString.replace(/&?features=$/, '');
      }

      chrome.tabs.update(tab.id, { url: newUrl.toString() });
    });
  } else {
    console.error('Chrome extension environment not available.');
  }
});
