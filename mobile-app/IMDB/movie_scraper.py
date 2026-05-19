import pandas as pd
import time
import random
import re
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
# We configure Chrome to run in "Headless" mode (hidden) or visible.
# Set HEADLESS = False to watch the bot work (Recommended for debugging)
HEADLESS = False 

def setup_driver():
    """Sets up the Chrome Browser."""
    chrome_options = Options()
    if HEADLESS:
        chrome_options.add_argument("--headless")
    
    # Anti-detection settings
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def clean_votes(vote_str):
    if not vote_str or vote_str == "N/A": return 0
    clean = vote_str.replace('(', '').replace(')', '').replace(',', '').strip()
    multiplier = 1
    if 'K' in clean:
        multiplier = 1000
        clean = clean.replace('K', '')
    elif 'M' in clean:
        multiplier = 1000000
        clean = clean.replace('M', '')
    try:
        return int(float(clean) * multiplier)
    except:
        return 0

def calculate_weighted_score(df):
    if df.empty: return df
    C = df['IMDB Rating'].mean()
    m = df['Vote Count'].quantile(0.25)
    def weighted_rating(x):
        v = x['Vote Count']
        R = x['IMDB Rating']
        if v + m == 0: return 0
        return (v/(v+m) * R) + (m/(v+m) * C)
    df['Weighted Score'] = df.apply(weighted_rating, axis=1)
    return df

def parse_card(item, page_id):
    data = {}
    
    # 1. Title
    title_tag = item.select_one(".ipc-title__text")
    raw_title = title_tag.text.strip() if title_tag else "N/A"
    data["Title"] = re.sub(r'^\d+\.\s*', '', raw_title)
    
    # 2. Rating & Votes
    rating_full = "N/A"
    rating_tag = item.select_one(".ipc-rating-star--base")
    if rating_tag: rating_full = rating_tag.get_text(strip=True)
    
    data["IMDB Rating"] = 0.0
    data["Vote Count Raw"] = "0"
    
    if rating_full != "N/A":
        rating_match = re.match(r"(\d\.\d)", rating_full)
        if rating_match: data["IMDB Rating"] = float(rating_match.group(1))
        vote_match = re.search(r"\(([\d\.KM]+)\)", rating_full)
        if vote_match: data["Vote Count Raw"] = vote_match.group(1)

    data["Vote Count"] = clean_votes(data["Vote Count Raw"])
    
    # 3. Metadata
    metadata_items = item.select(".dli-title-metadata-item")
    data["Release Year"] = metadata_items[0].text.strip() if len(metadata_items) > 0 else "N/A"
    data["Runtime"] = metadata_items[1].text.strip() if len(metadata_items) > 1 else "N/A"
    data["Rated"] = metadata_items[2].text.strip() if len(metadata_items) > 2 else "N/A"

    # 4. Text Search
    full_text = item.get_text(separator="|", strip=True)
    data["Director"] = "N/A"
    data["Stars"] = "N/A"
    
    dir_match = re.search(r"Director(?:s)?[:|]\s*([^|]+)", full_text)
    if dir_match: data["Director"] = dir_match.group(1).strip()
        
    stars_match = re.search(r"Star(?:s)?[:|]\s*([^|]+(?:\|[^|]+){0,3})", full_text)
    if stars_match:
        raw_stars = stars_match.group(1).replace('|', ', ').strip()
        if "Vote" in raw_stars: raw_stars = raw_stars.split("Vote")[0]
        data["Stars"] = raw_stars.strip(', ')

    data["Page_ID"] = page_id
    return data

def scrape_with_selenium():
    print("--- STARTING SELENIUM SCRAPER ---")
    print("Launching Chrome... Do not close the window that appears.")
    
    driver = setup_driver()
    all_data = []
    
    # Path setup
    script_location = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_location, "Movies_Output.xlsx")

    # LOOP 1 to 242
    for i in range(1, 243):
        page_id = f"in{i:07}"
        url = f"https://www.imdb.com/chart/movie/{page_id}/?count=100"
        
        print(f"Processing {i}/242: {page_id}...")
        
        try:
            driver.get(url)
            
            # --- THE SCROLL TRICK ---
            # Scroll down repeatedly to trigger lazy loading
            last_height = driver.execute_script("return document.body.scrollHeight")
            for _ in range(3): # Scroll 3 times
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1.5) # Wait for load
                new_height = driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height: break
                last_height = new_height
            # ------------------------
            
            # Check for 404 in title
            if "404" in driver.title or "Page Not Found" in driver.title:
                print(f"  [!] Page {page_id} does not exist.")
                continue

            # Parse with BeautifulSoup
            soup = BeautifulSoup(driver.page_source, "html.parser")
            
            # Get Category
            category = "Unknown"
            header_tag = soup.select_one("h1") or soup.select_one(".ipc-title__text")
            if header_tag:
                raw = header_tag.get_text(strip=True)
                clean = raw.replace("IMDb Charts", "").replace("Most Popular", "").replace("Movies", "").strip()
                category = clean.strip(": ")
            print(f"  -> Category: {category}")

            # Get Items
            items = soup.select("li.ipc-metadata-list-summary-item")
            print(f"  -> Found {len(items)} movies.")
            
            for item in items:
                info = parse_card(item, page_id)
                info["Category"] = category
                all_data.extend([info])

        except Exception as e:
            print(f"  [!] Error on {page_id}: {e}")
        
        # Short sleep between pages
        time.sleep(2)

    driver.quit()
    
    if not all_data:
        print("CRITICAL: No data found.")
        return

    # Process Data
    df = pd.DataFrame(all_data)
    
    print("Calculating scores...")
    df = calculate_weighted_score(df)
    
    # Columns
    cols = ['Category', 'Weighted Score', 'IMDB Rating', 'Vote Count', 'Title', 'Release Year', 'Director', 'Stars', 'Runtime', 'Rated', 'Page_ID']
    final_cols = [c for c in cols if c in df.columns] + [c for c in df.columns if c not in cols]
    df = df[final_cols]
    df = df.sort_values(by="Weighted Score", ascending=False)

    try:
        with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='MovieData', index=False)
            workbook = writer.book
            worksheet = writer.sheets['MovieData']
            
            score_fmt = workbook.add_format({'num_format': '0.00', 'bold': True, 'bg_color': '#DDEBF7'})
            worksheet.set_column(1, 1, 15, score_fmt) 
            
            for i, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
                if max_len > 60: max_len = 60
                worksheet.set_column(i, i, max_len)
                
        print(f"SUCCESS: Saved {len(df)} movies to {output_file}")
        
    except Exception as e:
        print(f"ERROR Saving Excel: {e}")

if __name__ == "__main__":
    scrape_with_selenium()