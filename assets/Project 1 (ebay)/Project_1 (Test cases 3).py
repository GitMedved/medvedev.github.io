import time
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select

options = Options()
options.page_load_strategy = 'eager'
options.add_argument('--headless')

service = Service(executable_path=ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)
wait = WebDriverWait(driver, 15, poll_frequency=1)

SEARCH_FIELD_LOCATOR = (By.ID, 'gh-ac')
SEARCH_BUTTON_LOCATOR = (By.ID, 'gh-search-btn')
CHECKBOX_APPLE_LOCATOR = (By.XPATH, '//span [text() = "Apple"]')
BRAND_LIST_LOCATOR = (By.XPATH, '//div[text() = "Brand"]')
CATEGORIES_SELECT_LOCATOR = (By.ID, 'gh-cat')


# Test case 3.1
driver.get('https://www.ebay.com/')
search_field = wait.until(EC.element_to_be_clickable(SEARCH_FIELD_LOCATOR))
search_field.send_keys('"iPhone 15"')
search_button = wait.until(EC.element_to_be_clickable(SEARCH_BUTTON_LOCATOR))
search_button.click()
items = driver.find_elements(By.CSS_SELECTOR, ".s-item__info")[:10]
invalid_items = []
valid_items_count = 0
for item in items:
    try:
        title_element = item.find_element(By.CSS_SELECTOR, ".s-item__title")
        title = title_element.text.strip().lower()
        if not title:
            continue
        valid_items_count += 1
        desc_element = item.find_element(By.CSS_SELECTOR, ".s-item__subtitle")
        desc = desc_element.text.strip().lower()
        is_iphone = ('iphone' in title) and ('15' in title or '15' in desc)
        if not is_iphone:
            invalid_items.append(title)
    except Exception as e:
        print(f"Пропущен элемент из-за ошибки: {str(e)}")
        continue
assert len(invalid_items) == 0, f"Test case 3.1 failed. Найдены неподходящие товары: {invalid_items}"

# Test case 3.2
driver.switch_to.new_window('tab')
driver.get('https://www.ebay.com/')
search_field = wait.until(EC.element_to_be_clickable(SEARCH_FIELD_LOCATOR))
search_field.send_keys('laptop')
search_button = wait.until(EC.element_to_be_clickable(SEARCH_BUTTON_LOCATOR))
search_button.click()
brand_list = wait.until(EC.element_to_be_clickable(BRAND_LIST_LOCATOR))
is_true = brand_list.get_attribute("aria-expanded") == "true"
if not is_true:
    brand_list.click()
checkbox_apple = wait.until(EC.element_to_be_clickable(CHECKBOX_APPLE_LOCATOR))
checkbox_apple.click()
time.sleep(1)
current_url = driver.current_url
assert "Brand=Apple" in current_url, "Test case 3.2 failed"

# Test case 3.3
driver.switch_to.new_window('tab')
driver.get('https://www.ebay.com/')
categories_dropdown_element = wait.until(EC.element_to_be_clickable(CATEGORIES_SELECT_LOCATOR))
categories_dropdown = Select(categories_dropdown_element)
categories_dropdown.select_by_visible_text('Consumer Electronics')
search_field = wait.until(EC.element_to_be_clickable(SEARCH_FIELD_LOCATOR))
search_field.send_keys('headphones')
search_button = wait.until(EC.element_to_be_clickable(SEARCH_BUTTON_LOCATOR))
search_button.click()
time.sleep(1)
current_url = driver.current_url
assert "sacat=293" in current_url, "Test case 3.3 failed"

print('All cases were passed =)')
