document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
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
    const featureElement = document.querySelector(`#${featureId}`).closest(".checkbox-wrapper-5");
    featureElement.classList.add("pinned");
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

    if (pinButton.classList.contains("pin-btn")) {
      const featureId = pinButton.getAttribute("data-feature-id");
      const featureElement = document.querySelector(`input#${featureId}`).closest(".checkbox-wrapper-5");

      if (featureElement.classList.contains("pinned")) {
        featureElement.classList.remove("pinned");
        removePinnedItem(featureId);
      } else {
        featureElement.classList.add("pinned");
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
});

document.getElementById('url-form').addEventListener('submit', function (event) {
  event.preventDefault();

  const selectedOptions = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  console.log('Selected options:', selectedOptions);

  const featureFlags = selectedOptions.join(',');
  console.log('Feature flags to append:', featureFlags);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
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
});
