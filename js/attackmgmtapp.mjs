/**
 * Copyright (c) 2025, Kirahi LLC
 * Max Seenisamy kirahi.com
 * 
 * ES Module for attack data management - Suppress CAN Attack Data in the database
 * this is the only MJS file that will be imported into the suppress.html file
 * all the other MJS files will be imported into this file
 * to change the table, you need to change the currentTable variable
 * the only function that has any hardcoded table / col references is inferAttackFieldType
 * not trying to further split the code, because we need to maintain State in one place
 * otherwise performance will be impaceted with several copies of the data in memory
 */

import { 
    handleError, 
    validateAndSubmitForm, 
    createFieldConfig,
    inferFieldType
} from './validation.mjs';
import { 
    fetchAllRows, 
    fetchPaginatedRows,
    fetchPaginatedRowsWithFilter,
    fetchFilteredRows, 
    createRow, 
    updateRow, 
    deleteRow,
    fetchTableMeta,
    generateRowKey
} from './restcallsfordbdata.mjs';
import { 
    buildDynamicForm, 
    displaytable, 
    createActionsHeader
} from './htmlhelpers.mjs';

// Global state for attack data management
let currentTableMeta = null;
let currentFormFields = new Map();
let currentRowKey = null; // Store the row key for updates
const currentTable = 'suppressCANattack'; // Attack data table name
// Pagination state
let currentRows = [];
let currentOffset = 0;
let currentLimit = 25;
let totalRows = 0;
let hasMoreRows = false;
// Label filter state
let currentLabelFilter = 'both'; // '0', '1', or 'both'

/**
 * Attack-specific field type inference
 * @param {string} fieldName - The field name to infer type for
 * @returns {string} The inferred field type
 */
function inferAttackFieldType(fieldName) {
    const name = fieldName.toLowerCase();
    
    // Attack-specific field type inference
    if (name === 'label') {
        return 'number';
    } else if (name.includes('attacktype') || name.includes('type')) {
        return 'select';
    } else if (name.includes('canid') || name.includes('id')) {
        return 'hex';
    } else if (name.includes('attackpattern') || name.includes('pattern')) {
        return 'hex';
    } else if (name.includes('severity') || name.includes('priority')) {
        return 'select';
    } else if (name.includes('timestamp') || name.includes('time')) {
        return 'datetime';
    } else if (name.includes('suppressionaction') || name.includes('action')) {
        return 'select';
    } else if (name.includes('description') || name.includes('comment')) {
        return 'textarea';
    }
    
    // Use generic inference for other fields
    return inferFieldType(fieldName);
}

/**
 * Initialize the application by loading table metadata
 */
async function initializeApp() {
    try {
        currentTableMeta = await fetchTableMeta(currentTable);
        console.log('Attack data table metadata loaded:', currentTableMeta);
    } catch (error) {
        handleError('Failed to initialize attack data management', error);
    }
}

/**
 * Display paginated attack data records with label filtering
 * @param {boolean} [resetPagination=false] - Whether to reset pagination to first page
 */
async function displayallitems(resetPagination = false) {
    try {
        if (resetPagination) {
            currentOffset = 0;
            currentRows = [];
        }

        // Fetch paginated data with label filter
        const result = await fetchPaginatedRowsWithFilter(currentTable, currentLimit, currentOffset, currentLabelFilter);
        
        console.log('Paginated Attack Items JSON from DB:', result.data?.length || 0, 'items');
        console.log('Total rows:', result.pagination?.total || 0);
        console.log('Has more:', result.pagination?.hasMore || false);
        console.log('Label filter:', currentLabelFilter);

        if (!Array.isArray(result.data) || result.data.length === 0) {
            if (currentOffset === 0) {
                console.log('No attack data returned from database');
                currentRows = [];
                const tableContainer = document.getElementById('attackdata-list-div');
                if (tableContainer) {
                    tableContainer.innerHTML = '<p>No attack data found.</p>';
                }
                addLoadMoreButton(false);
            }
            return;
        }

        // Update pagination state
        totalRows = result.pagination?.total || 0;
        hasMoreRows = result.pagination?.hasMore || false;

        // Append new rows to existing ones (for "Load More" functionality)
        if (currentOffset === 0) {
            currentRows = result.data;
        } else {
            currentRows = [...currentRows, ...result.data];
        }

        // Update offset for next load
        currentOffset += result.data.length;

        const actionsHeader = createActionsHeader(() => displayallitems(true));
        const tableContainer = document.getElementById('attackdata-list-div');
        
        if (tableContainer) {
            if (currentOffset === result.data.length) { // First load
                tableContainer.innerHTML = '';
                tableContainer.appendChild(actionsHeader);
            }
            displaytable(currentRows, prepareEditForm, deleterow, () => displayallitems(true));
        }
        
        // Add or update the Load More button
        addLoadMoreButton(hasMoreRows);
        
    } catch (error) {
        handleError('Failed to display attack data', error);
    }
}

/**
 * Display filtered attack data records
 * @param {string} searchTerm - The search term to filter by
 */
async function displayfiltereditems(searchTerm) {
    try {
        const rowsData = await fetchFilteredRows(currentTable, searchTerm);
        const actionsHeader = createActionsHeader(() => displayallitems(true));
        const tableContainer = document.getElementById('attackdata-list-div');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(actionsHeader);
            displaytable(rowsData, prepareEditForm, deleterow, () => displayallitems(true));
        }
        
        // Hide Load More button for search results
        addLoadMoreButton(false);
        
    } catch (error) {
        handleError('Failed to display filtered attack data', error);
    }
}

/**
 * Adds or updates the Load More button based on whether there are more rows to load
 * @param {boolean} hasMore - Whether there are more rows to load
 */
function addLoadMoreButton(hasMore) {
    // Remove existing Load More button if it exists
    const existingButton = document.getElementById('load-more-btn');
    if (existingButton) {
        existingButton.remove();
    }

    if (hasMore) {
        // Create Load More button
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.className = 'btn btn-primary mt-3';
        loadMoreBtn.innerHTML = `<i class="fas fa-plus"></i> Load More 25 Rows (${currentRows.length} of ${totalRows} shown)`;
        loadMoreBtn.onclick = () => displayallitems(false);
        
        // Find the table container and add the button after it
        const tableContainer = document.querySelector('.table-responsive') || document.querySelector('table') || document.querySelector('.table');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(loadMoreBtn, tableContainer.nextSibling);
        }
    }
}

/**
 * Prepare the form for adding a new record (clears any previous edit data)
 */
async function prepareAddNewForm() {
    try {
        // Reset row key for new record
        currentRowKey = null;
        
        // Get table metadata
        const tableMeta = await fetchTableMeta(currentTable);
        
        // Build dynamic form for new record (no existing data)
        const { formFields } = await buildDynamicForm(
            currentTable, 
            null, // No existing data for new record
            inferAttackFieldType
        );
        
        currentTableMeta = tableMeta;
        currentFormFields = formFields;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addnewattackform'));
        modal.show();
        
    } catch (error) {
        handleError('Failed to prepare add new form', error);
    }
}

/**
 * Prepare the edit form with existing attack data
 * @param {number} index - The index of the row to edit
 */
async function prepareEditForm(index) {
    try {
        // Use the currently displayed (filtered) rows instead of fetching all rows
        const rowData = currentRows[index];
        
        if (!rowData) {
            throw new Error('Attack data record not found');
        }
        
        // Get table metadata to determine the correct key format
        const tableMeta = await fetchTableMeta(currentTable);
        currentRowKey = generateRowKey(rowData, tableMeta);
        
        // Build dynamic form for editing
        const { formFields } = await buildDynamicForm(
            currentTable, 
            rowData, 
            inferAttackFieldType
        );
        
        currentTableMeta = tableMeta;
        currentFormFields = formFields;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addnewattackform'));
        modal.show();
        
    } catch (error) {
        handleError('Failed to prepare edit form', error);
    }
}

/**
 * Delete an attack data record
 * @param {number} index - The index of the row to delete
 */
async function deleterow(index) {
    try {
        // Use the currently displayed (filtered) rows instead of fetching all rows
        const rowData = currentRows[index];
        
        if (!rowData) {
            throw new Error('Attack data record not found');
        }
        
        // Get table metadata to determine the correct key format
        const tableMeta = await fetchTableMeta(currentTable);
        const rowKey = generateRowKey(rowData, tableMeta);
        
        if (confirm('Are you sure you want to delete this attack pattern?')) {
            await deleteRow(currentTable, rowKey);
            await displayallitems(true); // Refresh the table with reset pagination
        }
    } catch (error) {
        handleError('Failed to delete attack data record', error);
    }
}

/**
 * Handle form submission for adding/updating attack data
 */
async function handleFormSubmission() {
    try {
        if (!currentTableMeta) {
            await initializeApp();
        }
        
        const fieldConfig = createFieldConfig(
            currentTableMeta.columns, 
            currentTableMeta.primaryKey, 
            inferAttackFieldType
        );
        
        await validateAndSubmitForm(
            currentFormFields, 
            currentTableMeta, 
            saveRow, 
            'modal',
            inferAttackFieldType
        );
        
    } catch (error) {
        handleError('Form submission failed', error);
    }
}

/**
 * Save attack data (create or update)
 * @param {Object} formData - The form data to save
 */
async function saveRow(formData) {
    try {
        if (currentRowKey) {
            // Update existing record
            await updateRow(currentTable, currentRowKey, formData);
            currentRowKey = null; // Reset after update
        } else {
            // Create new record
            await createRow(currentTable, formData);
        }
        
        // Close modal and refresh table
        const modal = bootstrap.Modal.getInstance(document.getElementById('addnewattackform'));
        if (modal) {
            modal.hide();
        }
        
        await displayallitems();
        
    } catch (error) {
        handleError('Failed to save attack data', error);
    }
}

/**
 * Handle label filter change
 * @param {string} filterValue - The new filter value ('0', '1', or 'both')
 */
function handleLabelFilterChange(filterValue) {
    currentLabelFilter = filterValue;
    console.log('Label filter changed to:', filterValue);
    // Reset pagination and reload data
    displayallitems(true);
}

/**
 * Initialize the application when the page loads
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeApp();
        await displayallitems();
        
        // Add event listener for "Add New" button to use the new form preparation function
        const addNewBtn = document.getElementById('addNew');
        if (addNewBtn) {
            addNewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                prepareAddNewForm();
            });
        }
        
        // Add event listeners for label filter radio buttons
        const labelFilterRadios = document.querySelectorAll('input[name="labelFilter"]');
        labelFilterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    handleLabelFilterChange(e.target.value);
                }
            });
        });
    } catch (error) {
        handleError('Failed to initialize attack data management application', error);
    }
});

// Export functions for use in HTML
export { 
    handleFormSubmission, 
    displayfiltereditems, 
    displayallitems,
    prepareEditForm,
    prepareAddNewForm,
    handleLabelFilterChange,
    deleterow,
    saveRow
};
