figma.showUI(__html__, { width: 300, height: 400 });

// Define status indicators
const STATUS_INDICATORS = {
  'Complete': '•    🟢 ',
  'In Progress': '•    🟡 ',
  'Draft': '•    🛑',
  'Under Review': '•    👀 ',
  'Approved': '•    ✅ ',
  'Section Title': ' ↪ ',
  'Sub Category': '    ↪ '
};

// Store the status tags and colors in plugin data
figma.clientStorage.getAsync('pageStatuses').then(statuses => {
  if (!statuses) {
    figma.clientStorage.setAsync('pageStatuses', {});
  }
});

// Function to clean page name from all status indicators
function cleanPageName(pageName) {
  // Remove status indicators and following 0-1 characters only once
  const cleanedName = pageName.replace(/^\s*(?:•\s*[🟢🟡🛑👀✅]|↪)\s*.{0,1}/, '');
  return cleanedName.trim();
}

// Function to get status safely
function getStatusSafely(statuses, pageId) {
  if (!statuses || !pageId) return '';
  const pageStatus = statuses[pageId];
  return pageStatus && pageStatus.status ? pageStatus.status : '';
}

// Function to update page name with status
async function updatePageNameWithStatus(pageId, status) {
  const page = figma.getNodeById(pageId);
  if (!page || page.type !== 'PAGE') return;

  // Always clean the name first
  const originalName = cleanPageName(page.name);
  
  // If no status, just use original name
  if (!status) {
    page.name = originalName;
    return;
  }

  // Add status indicator at the beginning
  const indicator = STATUS_INDICATORS[status] || '';
  page.name = `${indicator}${originalName}`;
}

// Modify function to return all selected pages
async function getSelectedPagesWithoutStatus() {
  return figma.currentPage.selection
    .filter(node => node.type === 'PAGE')
    .concat([figma.currentPage]); // Include current page always
}

// Function to notify UI of selection change
async function notifySelectionChange() {
  const selectedPages = await getSelectedPagesWithoutStatus();
  const statuses = await figma.clientStorage.getAsync('pageStatuses') || {};
  const pageStatus = statuses[figma.currentPage.id] || {};
  
  figma.ui.postMessage({
    type: 'selection-changed',
    status: pageStatus.status || '',
    selectedPages: selectedPages.length,
    hasUnassignedPages: selectedPages.length > 0
  });
}

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'update-page-status') {
    const selectedPages = await getSelectedPagesWithoutStatus();
    const statuses = await figma.clientStorage.getAsync('pageStatuses') || {};
    
    // Update all selected pages regardless of current status
    for (const page of selectedPages) {
      if (msg.status) {
        statuses[page.id] = {
          status: msg.status
        };
        await updatePageNameWithStatus(page.id, msg.status);
      } else {
        // Handle status removal
        delete statuses[page.id];
        await updatePageNameWithStatus(page.id, null);
      }
    }
    
    await figma.clientStorage.setAsync('pageStatuses', statuses);
    
    figma.ui.postMessage({
      type: 'status-updated',
      pageId: figma.currentPage.id,
      status: getStatusSafely(statuses, figma.currentPage.id),
      affectedPages: selectedPages.length,
      hasUnassignedPages: true // Always enable status changes
    });
  }
  
  if (msg.type === 'get-current-page-status') {
    const pageId = figma.currentPage.id;
    const statuses = await figma.clientStorage.getAsync('pageStatuses') || {};
    const pageStatus = statuses[pageId] || {};
    const selectedPages = await getSelectedPagesWithoutStatus();
    
    figma.ui.postMessage({
      type: 'current-page-status',
      status: pageStatus.status || '',
      selectedPages: selectedPages.length,
      hasUnassignedPages: selectedPages.length > 0
    });
  }
};

// Listen for selection changes
figma.on('selectionchange', notifySelectionChange);

// Listen for page changes
figma.on('currentpagechange', notifySelectionChange);