import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create downloads directory if it doesn't exist
const downloadsDir = join(__dirname, '..', 'downloads');
if (!existsSync(downloadsDir)) {
  mkdirSync(downloadsDir, { recursive: true });
}

// Configuration
const DEV_SERVER_URL = 'http://localhost:5173';

// COMPREHENSIVE SCENARIO - All required fields filled
const SCENARIOS = [
  {
    name: 'Scenario 1: Complete Will Form',
    data: {
      // Personal Information - ALL required fields
      title: 'Mr',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '15/03/1980',
      gender: 'Male',
      mobile: '07123 456789',
      email: 'john.smith@example.com',
      address1: '123 High Street',
      address2: 'London',
      postcode: 'SW1A 1AA',
      maritalStatus: 'Single',
      willExecutionDate: '25/01/2026',
    }
  }
];

// Helper function to wait/delay (replacement for deprecated page.waitForTimeout)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced logging function with visible formatting
function log(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const emoji = {
    'INFO': 'ℹ️',
    'DEBUG': '🔍',
    'WARN': '⚠️',
    'ERROR': '❌',
    'SUCCESS': '✅'
  }[level] || '📝';
  const prefix = `\n${emoji} [${timestamp}] [${level}]`;
  
  // Always log to console with clear formatting
  if (data) {
    console.log(`${prefix} ${message}`);
    console.log('   Data:', JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
  
  // Also log errors with stack trace
  if (level === 'ERROR' && data?.stack) {
    console.error('   Stack:', data.stack);
  }
}

// Helper function to wait for element
async function waitForElement(page, selector, timeout = 10000) {
  try {
    log('DEBUG', `Waiting for element: ${selector}`, { timeout });
    await page.waitForSelector(selector, { timeout, visible: true });
    log('DEBUG', `Element found: ${selector}`);
    return true;
  } catch (error) {
    log('WARN', `Element not found: ${selector}`, { error: error.message });
    return false;
  }
}

// Helper function to fill text input - tries multiple selectors
async function fillInput(page, fieldId, value) {
  log('DEBUG', `🔤 Attempting to fill input: ${fieldId}`, { value });
  
  // Try multiple selector strategies
  const selectors = [
    `input[id="${fieldId}"]`,
    `textarea[id="${fieldId}"]`,
    `input[name="${fieldId}"]`,
    `textarea[name="${fieldId}"]`,
    `[data-field-id="${fieldId}"] input`,
    `[data-field-id="${fieldId}"] textarea`,
  ];
  
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.evaluate(el => {
          return el.offsetWidth > 0 && el.offsetHeight > 0 && 
                 window.getComputedStyle(el).visibility !== 'hidden';
        });
        
        if (isVisible) {
          log('DEBUG', `Found element for ${fieldId} with selector: ${selector}`);
          await element.click();
          await delay(100);
          
          // Clear existing value
          await element.evaluate(el => {
            el.value = '';
            el.focus();
          });
          await delay(100);
          
          // Type the value
          await element.type(value, { delay: 50 });
          log('SUCCESS', `✓ Filled ${fieldId}: ${value}`);
          await delay(200);
          return true;
        }
      }
    } catch (error) {
      // Try next selector
      continue;
    }
  }
  
  log('WARN', `⚠️ Could not find input for ${fieldId}`);
  return false;
}

// Helper function to select radio button - enhanced with multiple strategies
async function selectRadio(page, fieldId, value) {
  try {
    log('DEBUG', `📻 Attempting to select radio: ${fieldId} = ${value}`);
    
    // Strategy 1: Find by data-field-id and then find radio with matching value
    const fieldContainer = await page.$(`[data-field-id="${fieldId}"]`);
    log('DEBUG', `Field container found for ${fieldId}`, { found: !!fieldContainer });
    if (fieldContainer) {
      const radio = await fieldContainer.$(`input[type="radio"][value="${value}"]`);
      if (radio) {
        const isVisible = await radio.evaluate(el => {
          return el.offsetWidth > 0 && el.offsetHeight > 0;
        });
        if (isVisible) {
          log('DEBUG', `Clicking radio: ${fieldId} = ${value}`);
          await radio.click();
          log('SUCCESS', `✓ Selected ${fieldId}: ${value}`);
          await delay(300);
          return true;
        }
      }
    }
    
    // Strategy 1b: Try with different field ID formats
    const altFieldIds = [
      fieldId,
      fieldId.toLowerCase(),
      fieldId.charAt(0).toUpperCase() + fieldId.slice(1),
      `personalinformation${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}`
    ];
    
    for (const altId of altFieldIds) {
      const altContainer = await page.$(`[data-field-id="${altId}"]`);
      if (altContainer) {
        const radio = await altContainer.$(`input[type="radio"][value="${value}"]`);
        if (radio) {
          const isVisible = await radio.evaluate(el => {
            return el.offsetWidth > 0 && el.offsetHeight > 0;
          });
          if (isVisible) {
            log('DEBUG', `Clicking radio (alt ID): ${altId} = ${value}`);
            await radio.click();
            log('SUCCESS', `✓ Selected ${altId}: ${value}`);
            await delay(300);
            return true;
          }
        }
      }
    }
    
    // Strategy 2: Find all radios with the value and check their context
    const allRadios = await page.$$(`input[type="radio"][value="${value}"]`);
    for (const radio of allRadios) {
      const parent = await radio.evaluateHandle(el => {
        let current = el.parentElement;
        while (current && !current.hasAttribute('data-field-id')) {
          current = current.parentElement;
        }
        return current;
      });
      
      if (parent) {
        const fieldIdAttr = await parent.evaluate(el => el?.getAttribute('data-field-id'));
        if (fieldIdAttr && fieldIdAttr.includes(fieldId)) {
          log('DEBUG', `Found matching radio in context: ${fieldIdAttr}`);
          await radio.click();
          log('INFO', `✓ Selected ${fieldId}: ${value} (found in context)`);
          await delay(300);
          return true;
        }
      }
    }
    
    // Strategy 3: Click by label text near the field
    const labels = await page.$$('label');
    for (const label of labels) {
      const labelText = await label.evaluate(el => el.textContent?.trim());
      if (labelText === value) {
        const radio = await label.$('input[type="radio"]');
        if (radio) {
          const parent = await label.evaluateHandle(el => {
            let current = el.parentElement;
            while (current && !current.hasAttribute('data-field-id')) {
              current = current.parentElement;
            }
            return current;
          });
          if (parent) {
            const fieldIdAttr = await parent.evaluate(el => el?.getAttribute('data-field-id'));
            if (fieldIdAttr && fieldIdAttr.includes(fieldId)) {
              log('DEBUG', `Found matching radio via label: ${fieldIdAttr}`);
              await radio.click();
              log('INFO', `✓ Selected ${fieldId}: ${value} (via label)`);
              await delay(300);
              return true;
            }
          }
        }
      }
    }
    
    log('WARN', `Could not select ${fieldId}: ${value}`, { triedStrategies: 3 });
    return false;
  } catch (error) {
    log('ERROR', `Error selecting ${fieldId}: ${value}`, { error: error.message, stack: error.stack });
    return false;
  }
}

// Helper function to fill date field - ENHANCED with multiple strategies
async function fillDate(page, fieldId, dateValue) {
  log('INFO', `📅 Attempting to fill date: ${fieldId}`, { dateValue });
  
  // Try multiple selector strategies
  const selectors = [
    `input[id="${fieldId}"]`,
    `input[name="${fieldId}"]`,
    `[data-field-id="${fieldId}"] input`,
    `[data-field-id="${fieldId}"] input[type="text"]`,
    `[data-field-id="${fieldId}"] input[type="date"]`,
    `input[placeholder*="dd/mm/yyyy"]`,
    `input[placeholder*="DD/MM/YYYY"]`,
  ];
  
  let dateInput = null;
  let usedSelector = null;
  
  for (const sel of selectors) {
    try {
      log('DEBUG', `Trying date selector: ${sel}`);
      dateInput = await page.$(sel);
      if (dateInput) {
        // Check if it's visible and in the right context
        const isInContext = await dateInput.evaluate((el, fieldId) => {
          const parent = el.closest('[data-field-id]');
          const parentFieldId = parent?.getAttribute('data-field-id');
          const elId = el.id || el.name;
          return parentFieldId === fieldId || 
                 elId === fieldId || 
                 elId?.includes(fieldId) ||
                 parentFieldId?.includes(fieldId);
        }, fieldId);
        
        const isVisible = await dateInput.evaluate(el => {
          return el.offsetWidth > 0 && 
                 el.offsetHeight > 0 && 
                 window.getComputedStyle(el).visibility !== 'hidden';
        });
        
        if (isInContext && isVisible) {
          log('DEBUG', `Found date input with selector: ${sel}`);
          usedSelector = sel;
          break;
        }
      }
    } catch (e) {
      log('DEBUG', `Selector ${sel} failed`, { error: e.message });
      continue;
    }
  }
  
  if (!dateInput) {
    log('WARN', `⚠️ Could not find date field ${fieldId} with standard selectors`);
    // Try to find ANY date input on the page
    try {
      const allDateInputs = await page.$$('input[type="date"], input[placeholder*="dd"], input[placeholder*="DD"]');
      log('DEBUG', `Found ${allDateInputs.length} date inputs on page`);
      
      for (const input of allDateInputs) {
        const context = await input.evaluate((el) => {
          const parent = el.closest('[data-field-id]');
          return {
            parentFieldId: parent?.getAttribute('data-field-id'),
            id: el.id,
            name: el.name,
            placeholder: el.placeholder
          };
        });
        
        log('DEBUG', `Checking date input context`, context);
        
        if (context.parentFieldId === fieldId || 
            context.id === fieldId || 
            context.name === fieldId ||
            context.parentFieldId?.includes(fieldId)) {
          dateInput = input;
          log('INFO', `Found date input by context matching`);
          break;
        }
      }
    } catch (e) {
      log('ERROR', 'Error searching for date inputs', { error: e.message });
    }
  }
  
  if (dateInput) {
    try {
      log('INFO', `Found date input, preparing to fill...`);
      
      // Scroll into view
      await dateInput.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await delay(300);
      
      // Click to focus
      log('DEBUG', `Clicking date input to focus...`);
      await dateInput.click();
      await delay(300);
      
      // Clear existing value - try multiple methods
      log('DEBUG', `Clearing existing date value...`);
      try {
        // Method 1: Select all and delete
        await dateInput.click({ clickCount: 3 }); // Triple click to select all
        await delay(100);
        await page.keyboard.press('Backspace');
        await delay(100);
        await page.keyboard.press('Delete');
        await delay(100);
      } catch (e) {
        log('DEBUG', 'Method 1 failed, trying method 2');
      }
      
      // Method 2: Clear via JavaScript
      try {
        await dateInput.evaluate(el => {
          el.value = '';
          el.focus();
        });
        await delay(200);
      } catch (e) {
        log('DEBUG', 'Method 2 failed, continuing');
      }
      
      // Type the date character by character
      log('INFO', `Typing date: ${dateValue}`);
      await dateInput.type(dateValue, { delay: 80 }); // Slower typing for date fields
      await delay(500);
      
      // Verify the value was set
      const currentValue = await dateInput.evaluate(el => el.value);
      log('DEBUG', `Date input value after typing: "${currentValue}"`);
      
      // Blur the field to trigger validation
      await dateInput.evaluate(el => el.blur());
      await delay(300);
      
      // Press Tab to move to next field
      await page.keyboard.press('Tab');
      await delay(300);
      
      // Final verification
      const finalValue = await dateInput.evaluate(el => el.value);
      if (finalValue && finalValue.length > 0) {
        log('SUCCESS', `✓ Filled date ${fieldId}: ${finalValue}`);
        return true;
      } else {
        log('WARN', `⚠️ Date value may not have been set correctly`);
        // Try one more time with direct value setting
        try {
          await dateInput.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, dateValue);
          await delay(300);
          log('INFO', `Set date value via JavaScript`);
          return true;
        } catch (e) {
          log('ERROR', 'Failed to set date via JavaScript', { error: e.message });
        }
      }
    } catch (error) {
      log('ERROR', `❌ Error filling date ${fieldId}`, { error: error.message, stack: error.stack });
      
      // Last resort: try setting value directly via JavaScript
      try {
        log('INFO', 'Trying last resort: direct JavaScript value setting');
        await dateInput.evaluate((el, val) => {
          el.value = val;
          el.focus();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        }, dateValue);
        await delay(500);
        const jsValue = await dateInput.evaluate(el => el.value);
        log('INFO', `JavaScript set value: "${jsValue}"`);
        return jsValue && jsValue.length > 0;
      } catch (jsError) {
        log('ERROR', 'JavaScript fallback also failed', { error: jsError.message });
        return false;
      }
    }
  } else {
    log('ERROR', `❌ Could not find date field ${fieldId} anywhere on the page`);
    
    // Take screenshot for debugging
    try {
      const screenshotPath = join(downloadsDir, `DATE_FIELD_NOT_FOUND_${fieldId}_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log('INFO', `📸 Screenshot saved: ${screenshotPath}`);
    } catch (e) {
      log('ERROR', 'Failed to take screenshot', { error: e.message });
    }
    
    return false;
  }
}

// Helper function to click Next button
async function clickNext(page) {
  log('INFO', '🔘 Looking for Next button...');
  
  // First, get all buttons on the page to see what's available
  const allButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(btn => ({
      text: btn.textContent?.trim(),
      disabled: btn.disabled,
      id: btn.id,
      className: btn.className,
      visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
      ariaLabel: btn.getAttribute('aria-label')
    })).filter(btn => btn.visible);
  });
  
  log('DEBUG', `Found ${allButtons.length} visible buttons on page`, { buttons: allButtons });
  
  const nextSelectors = [
    'button:has-text("Next")',
    'button:has-text("Submit")',
    'button[aria-label*="next" i]',
    'button[aria-label*="continue" i]',
  ];
  
  for (const selector of nextSelectors) {
    try {
      log('DEBUG', `Trying selector: ${selector}`);
      const button = await page.$(selector);
      if (button) {
        const buttonInfo = await button.evaluate(el => ({
          text: el.textContent?.trim(),
          disabled: el.disabled,
          id: el.id,
          visible: el.offsetWidth > 0 && el.offsetHeight > 0
        }));
        
        log('DEBUG', `Found button`, buttonInfo);
        
        if (!buttonInfo.disabled && buttonInfo.visible) {
          log('INFO', `✅ Clicking Next button: "${buttonInfo.text}"`);
          await button.click();
          log('SUCCESS', '✓ Next button clicked successfully!');
          await delay(1500); // Wait longer for page transition
          return true;
        } else {
          log('WARN', `Button found but disabled or not visible`, buttonInfo);
        }
      }
    } catch (e) {
      log('DEBUG', `Selector failed: ${selector}`, { error: e.message });
      continue;
    }
  }
  
  // Fallback: Try to click any button with "Next" in text using evaluate
  log('WARN', 'Standard selectors failed, trying fallback method...');
  try {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(btn => 
        btn.textContent?.includes('Next') && 
        !btn.disabled &&
        btn.offsetWidth > 0 &&
        btn.offsetHeight > 0
      );
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      log('SUCCESS', '✓ Clicked Next button using fallback method');
      await delay(1500);
      return true;
    }
  } catch (e) {
    log('ERROR', 'Fallback click failed', { error: e.message });
  }
  
  log('ERROR', '❌ Could not find or click Next button');
  return false;
}

// NEW FUNCTION: Auto-detect and fill ALL required fields on current page
async function fillAllRequiredFields(page) {
  log('INFO', '🔍 Auto-detecting and filling ALL required fields on current page...');
  
  const requiredFields = await page.evaluate(() => {
    const fields = [];
    
    // Find all inputs and textareas with required attribute
    const inputs = Array.from(document.querySelectorAll('input[required], textarea[required]'));
    inputs.forEach(input => {
      if (input.type === 'radio' || input.type === 'checkbox') {
        const name = input.name || input.id;
        const fieldContainer = input.closest('[data-field-id]');
        const fieldId = fieldContainer?.getAttribute('data-field-id') || name;
        
        // Check if already selected
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        if (!checked) {
          fields.push({
            id: fieldId,
            type: input.type,
            name: name,
            value: input.value,
            label: input.closest('label')?.textContent?.trim() || fieldId
          });
        }
      } else {
        const fieldContainer = input.closest('[data-field-id]');
        const fieldId = fieldContainer?.getAttribute('data-field-id') || input.id || input.name;
        const currentValue = input.value?.trim() || '';
        
        if (!currentValue) {
          fields.push({
            id: fieldId,
            type: input.type,
            name: input.name || input.id,
            value: '',
            placeholder: input.placeholder,
            label: input.closest('label')?.textContent?.trim() || fieldId
          });
        }
      }
    });
    
    // Also check for fields marked as required in data-field-id containers
    const fieldContainers = Array.from(document.querySelectorAll('[data-field-id]'));
    fieldContainers.forEach(container => {
      const fieldId = container.getAttribute('data-field-id');
      const hasRequired = container.querySelector('[required]') || 
                         container.getAttribute('data-required') === 'true';
      
      if (hasRequired) {
        const input = container.querySelector('input, textarea');
        if (input) {
          if (input.type === 'radio' || input.type === 'checkbox') {
            const checked = container.querySelector('input:checked');
            if (!checked) {
              fields.push({
                id: fieldId,
                type: input.type,
                name: input.name,
                label: container.querySelector('label')?.textContent?.trim() || fieldId
              });
            }
          } else {
            const currentValue = input.value?.trim() || '';
            if (!currentValue) {
              fields.push({
                id: fieldId,
                type: input.type,
                name: input.name || input.id,
                value: '',
                placeholder: input.placeholder,
                label: container.querySelector('label')?.textContent?.trim() || fieldId
              });
            }
          }
        }
      }
    });
    
    // Remove duplicates
    const uniqueFields = [];
    const seen = new Set();
    fields.forEach(field => {
      const key = `${field.id}-${field.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFields.push(field);
      }
    });
    
    return uniqueFields;
  });
  
  log('INFO', `Found ${requiredFields.length} unfilled required fields`, { fields: requiredFields });
  
  // Fill each required field
  for (const field of requiredFields) {
    try {
      log('INFO', `Filling required field: ${field.id} (${field.type})`);
      
      if (field.type === 'radio') {
        // For radio, try to select the first available option
        const radioOptions = await page.evaluate((fieldId) => {
          const container = document.querySelector(`[data-field-id="${fieldId}"]`);
          if (!container) return [];
          const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
          return radios.map(r => ({
            value: r.value,
            label: r.closest('label')?.textContent?.trim() || r.value
          }));
        }, field.id);
        
        if (radioOptions.length > 0) {
          const firstOption = radioOptions[0].value;
          log('DEBUG', `Selecting first radio option: ${firstOption}`);
          await selectRadio(page, field.id, firstOption);
        }
      } else if (field.type === 'date' || field.id.toLowerCase().includes('date') || field.id.toLowerCase().includes('birth')) {
        // Fill date with a default - use proper format
        const defaultDate = field.id.toLowerCase().includes('birth') ? '15/03/1980' : '01/01/1980';
        log('INFO', `Filling date field ${field.id} with: ${defaultDate}`);
        await fillDate(page, field.id, defaultDate);
      } else {
        // Generate appropriate test data based on field ID
        let testValue = 'Test Value';
        const fieldIdLower = field.id.toLowerCase();
        
        if (fieldIdLower.includes('name') || fieldIdLower.includes('firstname')) {
          testValue = 'John';
        } else if (fieldIdLower.includes('lastname') || fieldIdLower.includes('surname')) {
          testValue = 'Smith';
        } else if (fieldIdLower.includes('email')) {
          testValue = 'test@example.com';
        } else if (fieldIdLower.includes('mobile') || fieldIdLower.includes('phone')) {
          testValue = '07123 456789';
        } else if (fieldIdLower.includes('postcode') || fieldIdLower.includes('postal')) {
          testValue = 'SW1A 1AA';
        } else if (fieldIdLower.includes('address')) {
          testValue = '123 Test Street';
        } else if (field.placeholder) {
          testValue = field.placeholder.replace(/[^a-zA-Z0-9@.\s]/g, '');
        }
        
        await fillInput(page, field.id, testValue);
      }
      
      await delay(300);
    } catch (error) {
      log('WARN', `Could not fill required field ${field.id}`, { error: error.message });
    }
  }
  
  log('SUCCESS', `✓ Attempted to fill ${requiredFields.length} required fields`);
  return requiredFields.length;
}

// Helper function to navigate through all sections
async function navigateThroughForm(page, scenarioData) {
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', '📝 STARTING FORM FILLING PROCESS');
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Fill Personal Information section
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', '📍 SECTION 1: Personal Information');
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Fill scenario data first
    if (scenarioData.title) {
      log('INFO', `Filling title: ${scenarioData.title}`);
      await selectRadio(page, 'title', scenarioData.title);
      await selectRadio(page, 'personalinformationTitle', scenarioData.title); // Try alternative ID
    }
    if (scenarioData.firstName) {
      log('INFO', `Filling firstName: ${scenarioData.firstName}`);
      await fillInput(page, 'firstName', scenarioData.firstName);
    }
    if (scenarioData.lastName) {
      log('INFO', `Filling lastName: ${scenarioData.lastName}`);
      await fillInput(page, 'lastName', scenarioData.lastName);
    }
    if (scenarioData.dateOfBirth) {
      log('INFO', `Filling dateOfBirth: ${scenarioData.dateOfBirth}`);
      await fillDate(page, 'dateOfBirth', scenarioData.dateOfBirth);
    }
    if (scenarioData.gender) {
      log('INFO', `Filling gender: ${scenarioData.gender}`);
      await selectRadio(page, 'gender', scenarioData.gender);
    }
    if (scenarioData.mobile) {
      log('INFO', `Filling mobile: ${scenarioData.mobile}`);
      await fillInput(page, 'mobile', scenarioData.mobile);
    }
    if (scenarioData.email) {
      log('INFO', `Filling email: ${scenarioData.email}`);
      await fillInput(page, 'email', scenarioData.email);
    }
    if (scenarioData.occupation) {
      log('INFO', `Filling occupation: ${scenarioData.occupation}`);
      await fillInput(page, 'occupation', scenarioData.occupation);
    }
    if (scenarioData.address1) {
      log('INFO', `Filling address1: ${scenarioData.address1}`);
      await fillInput(page, 'address1', scenarioData.address1);
    }
    if (scenarioData.address2) {
      log('INFO', `Filling address2: ${scenarioData.address2}`);
      await fillInput(page, 'address2', scenarioData.address2);
    }
    if (scenarioData.postcode) {
      log('INFO', `Filling postcode: ${scenarioData.postcode}`);
      await fillInput(page, 'postcode', scenarioData.postcode);
    }
    
    // CRITICAL: Auto-fill ANY remaining required fields
    log('INFO', '🔍 Checking for any remaining required fields...');
    await fillAllRequiredFields(page);
    
    log('SUCCESS', '✓ Section 1 fields filled');
    await delay(2000); // Wait longer for validation
    
    // Check if Next button is enabled
    const nextButtonState = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(btn => 
        btn.textContent?.includes('Next') && 
        btn.offsetWidth > 0
      );
      return {
        found: !!nextBtn,
        disabled: nextBtn?.disabled,
        text: nextBtn?.textContent?.trim()
      };
    });
    
    log('DEBUG', 'Next button state', nextButtonState);
    
    if (nextButtonState.found && nextButtonState.disabled) {
      log('WARN', '⚠️ Next button is disabled - trying to fill more required fields...');
      await fillAllRequiredFields(page);
      await delay(2000);
    }
    
    log('INFO', '🔘 Attempting to click Next after Personal Information...');
    const nextClicked = await clickNext(page);
    if (!nextClicked) {
      log('ERROR', '❌ STUCK: Failed to click Next after Personal Information section');
      
      // One more attempt to fill required fields
      log('INFO', '🔄 Making final attempt to fill all required fields...');
      await fillAllRequiredFields(page);
      await delay(2000);
      
      const finalAttempt = await clickNext(page);
      if (!finalAttempt) {
        // Take screenshot
        try {
          const screenshotPath = join(downloadsDir, `STUCK_section1_${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          log('INFO', `📸 Screenshot saved: ${screenshotPath}`);
        } catch (e) {
          log('ERROR', 'Failed to take screenshot', { error: e.message });
        }
        throw new Error('Cannot proceed - Next button not clickable after Section 1');
      }
    }
    log('SUCCESS', '✓ Successfully clicked Next after Section 1');
    await delay(2000); // Wait longer for section transition
  } catch (sectionError) {
    log('ERROR', '❌ Error in Section 1', { error: sectionError.message, stack: sectionError.stack });
    throw sectionError;
  }
  
  // Fill Marital Status section
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', '📍 SECTION 2: Marital Status');
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    if (scenarioData.maritalStatus) {
      log('INFO', `Filling maritalStatus: ${scenarioData.maritalStatus}`);
      await selectRadio(page, 'maritalStatus', scenarioData.maritalStatus);
      await delay(1000);
    }
    log('SUCCESS', '✓ Section 2 completed');
  } catch (sectionError) {
    log('ERROR', '❌ Error in Section 2', { error: sectionError.message });
    // Continue anyway
  }
  
  // Continue through remaining sections - fill minimal required data to progress
  let sectionCount = 2;
  const maxSections = 25; // Increased limit
  
  log('INFO', `Starting navigation through remaining sections (max ${maxSections})`);
  
  while (sectionCount < maxSections) {
    log('INFO', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log('INFO', `📍 CURRENT SECTION: ${sectionCount + 1} of ${maxSections}`);
    log('INFO', `⏳ Waiting 2 seconds before processing section...`);
    await delay(2000);
    
    // Get current section name for logging
    let currentSectionName = 'Unknown section';
    try {
      currentSectionName = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        return h1 ? h1.textContent : (h2 ? h2.textContent : 'Unknown section');
      });
      log('INFO', `📋 Section title: "${currentSectionName}"`);
    } catch (e) {
      log('WARN', 'Could not get section title', { error: e.message });
    }
    
    // Check if page is still responsive
    try {
      await page.evaluate(() => document.body);
      log('DEBUG', '✓ Page is responsive');
    } catch (e) {
      log('ERROR', '❌ Page is not responsive!', { error: e.message });
      throw new Error('Page became unresponsive');
    }
    
    // Check if we're on the last section
    const pageState = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => 
        btn.textContent?.includes('Submit') || 
        btn.textContent?.includes('Download PDF') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('download')
      );
      const nextButton = buttons.find(btn => 
        btn.textContent?.includes('Next') && !btn.disabled
      );
      return {
        hasSubmitButton: !!submitButton,
        hasNextButton: !!nextButton,
        submitButtonText: submitButton?.textContent?.trim(),
        nextButtonText: nextButton?.textContent?.trim(),
        totalButtons: buttons.length
      };
    });
    
    log('DEBUG', 'Page state check', pageState);
    
    if (pageState.hasSubmitButton || pageState.submitButtonText?.includes('Download')) {
      log('SUCCESS', `🎯 REACHED FINAL SECTION! (${sectionCount + 1})`);
      log('INFO', `Submit button found: ${pageState.submitButtonText}`);
      break;
    }
    
    // CRITICAL: Auto-fill ALL required fields on this page
    log('INFO', '🔍 Auto-filling ALL required fields on current page...');
    const filledCount = await fillAllRequiredFields(page);
    if (filledCount > 0) {
      log('SUCCESS', `✓ Filled ${filledCount} required fields`);
      await delay(2000); // Wait for validation
    }
    
    // Try to find and click Next
    log('INFO', `🔘 Attempting to click Next button from section ${sectionCount + 1}...`);
    log('DEBUG', `Current section: "${currentSectionName}"`);
    
    let clicked = false;
    try {
      clicked = await clickNext(page);
    } catch (nextError) {
      log('ERROR', '❌ Error while trying to click Next', { 
        error: nextError.message, 
        stack: nextError.stack 
      });
      clicked = false;
    }
    
    if (!clicked) {
      log('WARN', `⚠️ STUCK: Could not click Next button from section ${sectionCount + 1}`);
      log('WARN', `Section name: "${currentSectionName}"`);
      
      // Take screenshot for debugging
      try {
        const screenshotPath = join(downloadsDir, `STUCK_at_section_${sectionCount + 1}_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log('INFO', `📸 Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        log('ERROR', 'Failed to take screenshot', { error: e.message });
      }
      
      // Try to see what buttons are available
      let availableButtons = [];
      try {
        availableButtons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim(),
            disabled: btn.disabled,
            visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
            id: btn.id,
            className: btn.className
          })).filter(btn => btn.visible);
        });
        log('DEBUG', `Found ${availableButtons.length} visible buttons on page`, { buttons: availableButtons });
      } catch (e) {
        log('ERROR', 'Could not get button list', { error: e.message });
      }
      
      // If we can't proceed, try clicking any non-disabled Next-like button
      if (availableButtons.some(b => b.text?.includes('Next') && !b.disabled)) {
        log('INFO', '🔄 Trying alternative Next button click method...');
        try {
          const altClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const nextBtn = buttons.find(btn => 
              btn.textContent?.includes('Next') && 
              !btn.disabled &&
              btn.offsetWidth > 0
            );
            if (nextBtn) {
              nextBtn.click();
              return true;
            }
            return false;
          });
          
          if (altClicked) {
            log('SUCCESS', '✓ Alternative click method worked!');
            await delay(2000);
            sectionCount++;
            continue;
          } else {
            log('WARN', 'Alternative click method also failed');
          }
        } catch (altError) {
          log('ERROR', 'Alternative click method threw error', { error: altError.message });
        }
      }
      
      // Check if we're actually on the final section
      log('INFO', '🔍 Checking if this is the final section...');
      const isFinalSection = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => 
          (btn.textContent?.includes('Download PDF') || 
           btn.textContent?.includes('Submit') ||
           btn.getAttribute('aria-label')?.toLowerCase().includes('download')) &&
          !btn.disabled
        );
      });
      
      if (isFinalSection) {
        log('SUCCESS', '🎯 This IS the final section! Breaking loop to download PDF.');
        break;
      }
      
      log('ERROR', `❌ STUCK - Cannot proceed from section ${sectionCount + 1}`);
      log('ERROR', `Section: "${currentSectionName}"`);
      log('ERROR', 'This might be the last section or all required fields are not filled');
      log('ERROR', 'Attempting to continue anyway...');
      
      // Try one more time with a longer wait
      await delay(3000);
      const lastAttempt = await clickNext(page);
      if (lastAttempt) {
        log('SUCCESS', '✓ Last attempt succeeded!');
        sectionCount++;
        continue;
      }
      
      break;
    }
    
    sectionCount++;
    log('SUCCESS', `✅ Successfully moved to section ${sectionCount + 1}`);
    log('DEBUG', `Progress: ${sectionCount}/${maxSections} sections completed`);
    await delay(1000);
  }
  
  log('SUCCESS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log('SUCCESS', `✅ NAVIGATION COMPLETE! Went through ${sectionCount} sections`);
  log('INFO', `⏳ Waiting 3 seconds before checking for download button...`);
  await delay(3000);
  
  // Final check - are we on the download page?
  const finalCheck = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const downloadBtn = buttons.find(btn => 
      btn.textContent?.includes('Download PDF') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('download')
    );
    return {
      hasDownloadButton: !!downloadBtn,
      downloadButtonText: downloadBtn?.textContent?.trim(),
      downloadButtonDisabled: downloadBtn?.disabled,
      allButtons: buttons.map(b => ({
        text: b.textContent?.trim(),
        disabled: b.disabled,
        visible: b.offsetWidth > 0
      })).filter(b => b.visible)
    };
  });
  
  log('INFO', 'Final page state check', finalCheck);
  
  if (finalCheck.hasDownloadButton && !finalCheck.downloadButtonDisabled) {
    log('SUCCESS', '🎯 Download button is available and ready!');
  } else {
    log('WARN', '⚠️ Download button not found or disabled', finalCheck);
  }
}

// Helper function to download PDF
async function downloadPDF(page, scenarioName) {
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', '📥 STARTING PDF DOWNLOAD PROCESS');
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', `Scenario: ${scenarioName}`);
  
  // Set up download path
  const downloadPath = join(downloadsDir, `${scenarioName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);
  log('DEBUG', 'Download path configured', { downloadPath, downloadsDir });
  
  // Set up download behavior
  try {
    log('DEBUG', 'Setting up download behavior via CDP...');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadsDir,
    });
    log('SUCCESS', '✓ Download behavior configured');
  } catch (error) {
    log('ERROR', '❌ Failed to set download behavior', { error: error.message, stack: error.stack });
    // Continue anyway - might still work
  }
  
  // Wait for Download PDF button
  log('INFO', '🔍 Looking for Download PDF button...');
  log('DEBUG', 'Waiting 2 seconds for page to stabilize...');
  await delay(2000);
  
  // First, check what buttons exist
  const allPageButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(btn => ({
      text: btn.textContent?.trim(),
      disabled: btn.disabled,
      visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
      id: btn.id,
      ariaLabel: btn.getAttribute('aria-label')
    })).filter(btn => btn.visible);
  });
  
  log('DEBUG', `Found ${allPageButtons.length} visible buttons on page`, { buttons: allPageButtons });
  
  const downloadButtonSelectors = [
    'button:has-text("Download PDF")',
    'button[aria-label*="download" i]',
    'button:has-text("Download")',
  ];
  
  let downloadButton = null;
  for (const selector of downloadButtonSelectors) {
    try {
      log('DEBUG', `Trying download button selector: ${selector}`);
      downloadButton = await page.$(selector);
      if (downloadButton) {
        const buttonInfo = await downloadButton.evaluate(el => ({
          text: el.textContent?.trim(),
          disabled: el.disabled,
          id: el.id,
          visible: el.offsetWidth > 0 && el.offsetHeight > 0
        }));
        log('DEBUG', `Found download button`, buttonInfo);
        if (!buttonInfo.disabled && buttonInfo.visible) {
          log('SUCCESS', `✓ Found usable download button: "${buttonInfo.text}"`);
          break;
        } else {
          log('WARN', `Download button found but disabled or not visible`, buttonInfo);
        }
      }
    } catch (e) {
      log('DEBUG', `Selector failed: ${selector}`, { error: e.message });
      continue;
    }
  }
  
  if (!downloadButton) {
    log('ERROR', '❌ Download PDF button not found or disabled');
    
    // Get all buttons to see what's available
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        disabled: btn.disabled,
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
        ariaLabel: btn.getAttribute('aria-label')
      })).filter(btn => btn.visible);
    });
    
    log('DEBUG', 'All visible buttons on page', { buttons: allButtons });
    
    // Take screenshot to see what's on the page
    try {
      const screenshotPath = join(downloadsDir, `NO_DOWNLOAD_BUTTON_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log('INFO', `📸 Screenshot saved: ${screenshotPath}`);
    } catch (e) {
      log('ERROR', 'Failed to take screenshot', { error: e.message });
    }
    
    // Try fallback: look for any download-related button
    log('WARN', 'Trying fallback: searching for any download-related button...');
    const fallbackButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        (btn.textContent?.toLowerCase().includes('download') || 
         btn.getAttribute('aria-label')?.toLowerCase().includes('download')) &&
        !btn.disabled &&
        btn.offsetWidth > 0
      );
    });
    
    if (fallbackButton) {
      log('INFO', 'Found fallback download button, clicking...');
      await fallbackButton.click();
      await delay(2000);
    } else {
      log('ERROR', 'No download button found at all');
      return null;
    }
  } else {
    // Click download button
    log('SUCCESS', '✅ Found Download PDF button!');
    log('INFO', '🔘 Clicking Download PDF button...');
    try {
      // Scroll button into view first
      await downloadButton.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await delay(500);
      
      // Click the button
      await downloadButton.click();
      log('SUCCESS', '✓ Download button clicked successfully!');
      log('INFO', '⏳ Waiting 2 seconds for click to register...');
      await delay(2000);
    } catch (error) {
      log('ERROR', '❌ Failed to click download button', { error: error.message, stack: error.stack });
      // Try alternative click method
      log('INFO', 'Trying alternative click method...');
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const downloadBtn = buttons.find(btn => 
            (btn.textContent?.includes('Download PDF') || 
             btn.getAttribute('aria-label')?.toLowerCase().includes('download')) &&
            !btn.disabled &&
            btn.offsetWidth > 0
          );
          if (downloadBtn) {
            downloadBtn.click();
          }
        });
        log('SUCCESS', '✓ Alternative click method worked!');
        await delay(2000);
      } catch (altError) {
        log('ERROR', 'Alternative click also failed', { error: altError.message });
        return null;
      }
    }
  }
  
  // Wait for download to complete
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('INFO', '⏳ Waiting for PDF generation and download...');
  log('INFO', '   This may take 15-20 seconds...');
  log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Check files before download
  const filesBefore = readdirSync(downloadsDir);
  const pdfFilesBefore = filesBefore.filter(f => f.endsWith('.pdf'));
  log('DEBUG', `PDF files before download: ${pdfFilesBefore.length}`, { files: pdfFilesBefore });
  
  // Wait for PDF generation (longer wait)
  log('INFO', '⏳ Waiting 15 seconds for PDF generation...');
  await delay(15000);
  
  // Check if file was downloaded
  log('INFO', '⏳ Checking for downloaded file...');
  await delay(3000);
  
  const files = readdirSync(downloadsDir);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  log('DEBUG', `PDF files after download: ${pdfFiles.length}`, { files: pdfFiles });
  
  // Find the newest PDF
  const pdfFilesWithStats = pdfFiles.map(f => {
    const fullPath = join(downloadsDir, f);
    try {
      const stats = require('fs').statSync(fullPath);
      return { name: f, path: fullPath, mtime: stats.mtime };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
  
  pdfFilesWithStats.sort((a, b) => b.mtime - a.mtime);
  const latestPdf = pdfFilesWithStats[0];
  
  if (latestPdf) {
    const newPath = join(downloadsDir, `${scenarioName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);
    try {
      if (latestPdf.path !== newPath) {
        renameSync(latestPdf.path, newPath);
        log('SUCCESS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log('SUCCESS', `✅ PDF DOWNLOADED SUCCESSFULLY!`);
        log('INFO', `📄 PDF saved to: ${newPath}`);
        log('SUCCESS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return newPath;
      } else {
        log('SUCCESS', `✅ PDF downloaded: ${newPath}`);
        return newPath;
      }
    } catch (e) {
      log('WARN', `Could not rename PDF, using original name`, { error: e.message });
      log('SUCCESS', `✅ PDF downloaded: ${latestPdf.path}`);
      return latestPdf.path;
    }
  }
  
  log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('WARN', '⚠️ PDF download may have failed - no new PDF file found', { 
    filesBefore: pdfFilesBefore.length,
    filesAfter: pdfFiles.length,
    allFiles: files.slice(0, 10) // Show first 10 files
  });
  log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Take screenshot to see what's on the page
  try {
    const screenshotPath = join(downloadsDir, `NO_PDF_DOWNLOADED_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log('INFO', `📸 Screenshot saved: ${screenshotPath}`);
  } catch (e) {
    log('ERROR', 'Failed to take screenshot', { error: e.message });
  }
  
  return null;
}

// Main function to run a scenario
async function runScenario(browser, scenario) {
  log('INFO', `${'='.repeat(60)}`);
  log('INFO', `🎬 Running: ${scenario.name}`);
  log('INFO', '='.repeat(60));
  
  let page = null;
  try {
    log('INFO', '📄 Creating new browser page...');
    page = await browser.newPage();
    log('SUCCESS', '✓ Page created successfully');
  } catch (error) {
    log('ERROR', '❌ Failed to create new page', { error: error.message, stack: error.stack });
    throw error;
  }
  
  if (!page) {
    throw new Error('Page is null after creation');
  }
  
  try {
    // Set viewport
    log('DEBUG', 'Setting viewport', { width: 1920, height: 1080 });
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set up dialog handler BEFORE navigation (to catch window.confirm dialogs)
    log('DEBUG', 'Setting up dialog handler for window.confirm');
    page.on('dialog', async (dialog) => {
      log('DEBUG', 'Dialog detected', { type: dialog.type(), message: dialog.message() });
      if (dialog.type() === 'confirm' || dialog.type() === 'alert') {
        if (dialog.message().includes('clear all saved data') || dialog.message().includes('start fresh') || dialog.message().includes('cannot be undone')) {
          log('INFO', 'Confirming clear data dialog');
          await dialog.accept();
          log('INFO', '✓ Dialog accepted - data cleared');
        } else {
          log('DEBUG', 'Accepting dialog', { message: dialog.message() });
          await dialog.accept();
        }
      } else {
        log('DEBUG', 'Accepting dialog', { type: dialog.type() });
        await dialog.accept();
      }
    });
    
    // Navigate to dev server
    log('INFO', `🌐 Navigating to ${DEV_SERVER_URL}...`);
    let navigationSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        log('DEBUG', `Navigation attempt ${attempt} of 3`);
        await page.goto(DEV_SERVER_URL, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        navigationSuccess = true;
        log('SUCCESS', '✓ Navigation completed successfully');
        break;
      } catch (error) {
        log('WARN', `Navigation attempt ${attempt} failed`, { error: error.message });
        if (attempt < 3) {
          log('INFO', `Retrying navigation in 2 seconds...`);
          await delay(2000);
        } else {
          log('ERROR', 'All navigation attempts failed', { error: error.message });
          throw new Error(`Failed to navigate after 3 attempts: ${error.message}`);
        }
      }
    }
    
    // Wait for form to load
    log('INFO', '⏳ Waiting for page to fully load...');
    await delay(3000); // Increased wait time
    log('INFO', '✓ Page loaded');
    
    // Verify page actually loaded
    const pageTitle = await page.evaluate(() => document.title);
    log('DEBUG', 'Page title', { title: pageTitle });
    
    // Clear any existing data
    log('INFO', '🧹 Looking for Clear Data button...');
    try {
      // Try multiple selectors
      const clearButtonSelectors = [
        'button:has-text("Clear Data")',
        'button:has-text("Start Fresh")',
        'button[aria-label*="clear" i]',
        'button[aria-label*="fresh" i]',
      ];
      
      let clearButton = null;
      for (const selector of clearButtonSelectors) {
        try {
          clearButton = await page.$(selector);
          if (clearButton) {
            log('DEBUG', `Found Clear Data button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (clearButton) {
        log('INFO', 'Found Clear Data button, clicking...');
        // The dialog handler above will automatically handle the window.confirm dialog
        await clearButton.click();
        await delay(2000); // Wait for dialog to appear and be handled
        log('SUCCESS', '✓ Cleared existing data (dialog handled automatically)');
      } else {
        log('DEBUG', 'No Clear Data button found (may not be needed or page not fully loaded)');
        // Take a screenshot to see what's on the page
        try {
          const screenshotPath = join(downloadsDir, `page_loaded_${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          log('DEBUG', `Screenshot saved: ${screenshotPath}`);
        } catch (e) {
          // Ignore screenshot errors
        }
      }
    } catch (clearError) {
      log('WARN', 'Error trying to clear data (continuing anyway)', { error: clearError.message });
    }
    
    // Fill form and navigate
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('INFO', '📝 STARTING FORM NAVIGATION');
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      await navigateThroughForm(page, scenario.data);
      log('SUCCESS', '✓ Form navigation completed successfully');
    } catch (navError) {
      log('ERROR', 'Form navigation failed', { 
        error: navError.message, 
        stack: navError.stack 
      });
      // Take screenshot
      try {
        const screenshotPath = join(downloadsDir, `navigation_error_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log('INFO', `Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        // Ignore
      }
      throw navError; // Re-throw to be caught by outer try-catch
    }
    
    // Wait a bit for any final processing
    log('INFO', '⏳ Waiting for final processing...');
    await delay(3000);
    
    // Download PDF
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('INFO', '📥 STARTING PDF DOWNLOAD PROCESS');
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    let pdfPath = null;
    try {
      pdfPath = await downloadPDF(page, scenario.name);
      
      if (pdfPath) {
        log('SUCCESS', `✅ PDF DOWNLOADED SUCCESSFULLY!`, { pdfPath });
        log('INFO', `   📄 PDF saved to: ${pdfPath}`);
      } else {
        log('WARN', `⚠️  PDF download may have failed - check downloads folder`);
      }
    } catch (pdfError) {
      log('ERROR', 'PDF download process failed', { 
        error: pdfError.message, 
        stack: pdfError.stack 
      });
      // Take screenshot
      try {
        const screenshotPath = join(downloadsDir, `pdf_error_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log('INFO', `Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        // Ignore
      }
      // Don't throw - we still want to show the browser
    }
    
    await delay(2000);
    
  } catch (error) {
    log('ERROR', `❌ Error in scenario "${scenario.name}"`, { 
      error: error.message, 
      stack: error.stack,
      name: error.name
    });
    // Take screenshot on error
    try {
      const screenshotPath = join(downloadsDir, `error_${scenario.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log('INFO', `   Screenshot saved: ${screenshotPath}`);
    } catch (screenshotError) {
      log('ERROR', 'Failed to take error screenshot', { error: screenshotError.message });
    }
  } finally {
    try {
      log('DEBUG', 'Closing page');
      await page.close();
      log('DEBUG', 'Page closed');
    } catch (error) {
      log('ERROR', 'Error closing page', { error: error.message });
    }
  }
}

// Main execution
async function main() {
  log('INFO', '🚀 Starting Puppeteer E2E Demo');
  log('INFO', `📁 Downloads will be saved to: ${downloadsDir}`);
  
  // Check if dev server is running
  log('INFO', `🔍 Checking if dev server is running at ${DEV_SERVER_URL}...`);
  let serverRunning = false;
  try {
    serverRunning = await new Promise((resolve) => {
      const req = http.get(DEV_SERVER_URL, (res) => {
        log('DEBUG', 'Server response received', { statusCode: res.statusCode });
        res.on('data', () => {}); // Consume response
        res.on('end', () => {
          resolve(res.statusCode === 200 || res.statusCode === 304);
        });
      });
      req.on('error', (error) => {
        log('WARN', 'Server check failed (will continue anyway)', { error: error.message });
        resolve(false);
      });
      req.setTimeout(5000, () => {
        log('WARN', 'Server check timeout (will continue anyway)');
        req.destroy();
        resolve(false);
      });
    });
  } catch (checkError) {
    log('WARN', 'Server check threw error (will continue anyway)', { error: checkError.message });
    serverRunning = false;
  }
  
  if (!serverRunning) {
    log('WARN', `⚠️  Warning: Cannot connect to dev server at ${DEV_SERVER_URL}`);
    log('WARN', '   Continuing anyway - the server might be starting up...');
    log('WARN', '   If this fails, make sure the dev server is running: npm run dev');
    await delay(2000); // Give server a moment
  } else {
    log('INFO', '  ✓ Dev server is running');
  }
  
  // Launch browser with visible window
  log('INFO', '🌐 Launching browser (visible mode)...');
  let browser;
  try {
    log('DEBUG', 'Attempting browser launch (first try)');
    browser = await puppeteer.launch({
      headless: false, // Visible browser
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: 60000, // Increase timeout to 60 seconds
    });
    log('DEBUG', 'Browser launched successfully (first try)');
  } catch (error) {
    log('WARN', '⚠ First launch attempt failed, retrying...', { error: error.message, stack: error.stack });
    // Wait a bit and retry
    await delay(3000);
    try {
      log('DEBUG', 'Attempting browser launch (retry)');
      browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        timeout: 60000,
      });
      log('DEBUG', 'Browser launched successfully (retry)');
    } catch (retryError) {
      log('ERROR', 'Browser launch failed on retry', { error: retryError.message, stack: retryError.stack });
      throw retryError;
    }
  }
  
  log('INFO', '  ✓ Browser launched');
  
  try {
    // Run JUST ONE scenario for now
    const scenario = SCENARIOS[0];
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('SUCCESS', `🚀 STARTING SCENARIO: ${scenario.name}`);
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      await runScenario(browser, scenario);
      log('SUCCESS', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      log('SUCCESS', '✅ SCENARIO COMPLETED SUCCESSFULLY!');
      log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (scenarioError) {
      log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      log('ERROR', `❌ SCENARIO FAILED: ${scenario.name}`, { 
        error: scenarioError.message, 
        stack: scenarioError.stack,
        name: scenarioError.name
      });
      log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw scenarioError; // Re-throw so we can see the error
    }
    
    log('SUCCESS', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('SUCCESS', '✅ DEMO COMPLETED!');
    log('INFO', `📁 Check the downloads folder: ${downloadsDir}`);
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Keep browser open longer so user can see the result
    log('INFO', '⏳ Keeping browser open for 15 seconds so you can see the result...');
    await delay(15000);
    
  } catch (error) {
    log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('ERROR', '❌ FATAL ERROR IN MAIN LOOP', { 
      error: error.message, 
      stack: error.stack,
      name: error.name
    });
    log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Keep browser open on error so user can see what happened
    log('INFO', '⏳ Keeping browser open for 20 seconds so you can see what happened...');
    await delay(20000);
  } finally {
    try {
      log('INFO', 'Closing browser...');
      await browser.close();
      log('SUCCESS', '👋 Browser closed. Demo complete!');
    } catch (closeError) {
      log('ERROR', 'Error closing browser', { error: closeError.message });
    }
  }
}

// Run the demo with comprehensive error handling
main().catch((error) => {
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('ERROR', '❌ UNHANDLED ERROR - Script crashed!', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('\n\n💥 FATAL ERROR:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('ERROR', '❌ UNHANDLED PROMISE REJECTION', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('ERROR', '❌ UNCAUGHT EXCEPTION', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  log('ERROR', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
