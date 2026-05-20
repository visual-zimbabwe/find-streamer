import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import re
import time

# --- CONFIGURATION ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

def get_soup(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.content, "html.parser")
    except Exception as e:
        print(f"!!! Error fetching {url}: {e}")
        return None

def clean_votes(vote_str):
    """Converts '858K' or '1.2M' into actual numbers (858000)."""
    if not vote_str or vote_str == "N/A":
        return 0
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
    """Formula: (v / (v+m)) * R + (m / (v+m)) * C"""
    if df.empty: return df
    C = df['IMDB Rating'].mean()
    m = df['Vote Count'].quantile(0.25)
    def weighted_rating(x):
        v = x['Vote Count']
        R = x['IMDB Rating']
        if v == 0: return 0
        return (v/(v+m) * R) + (m/(v+m) * C)
    df['Weighted Score'] = df.apply(weighted_rating, axis=1)
    return df

def parse_new_layout(item):
    """
    Scrapes the 'New' IMDb layout using a 'Text Search' strategy 
    to find Director/Stars even if class names change.
    """
    data = {}
    
    # 1. Title
    title_tag = item.select_one(".ipc-title__text")
    raw_title = title_tag.text.strip() if title_tag else "N/A"
    data["Title"] = re.sub(r'^\d+\.\s*', '', raw_title)
    
    # 2. Rating & Votes
    rating_full = "N/A"
    rating_tag = item.select_one(".ipc-rating-star--base")
    if rating_tag:
        rating_full = rating_tag.get_text(strip=True)
    
    data["IMDB Rating"] = 0.0
    data["Vote Count Raw"] = "0"
    
    if rating_full != "N/A":
        rating_match = re.match(r"(\d\.\d)", rating_full)
        if rating_match:
            data["IMDB Rating"] = float(rating_match.group(1))
        vote_match = re.search(r"\(([\d\.KM]+)\)", rating_full)
        if vote_match:
            data["Vote Count Raw"] = vote_match.group(1)

    data["Vote Count"] = clean_votes(data["Vote Count Raw"])
    
    # 3. Metadata (Year, Runtime, Age Rating)
    # These are usually in a list of spans like "2012 | 2h 23m | PG-13"
    metadata_items = item.select(".dli-title-metadata-item")
    data["Release Year"] = metadata_items[0].text.strip() if len(metadata_items) > 0 else "N/A"
    data["Runtime"] = metadata_items[1].text.strip() if len(metadata_items) > 1 else "N/A"
    data["Rated"] = metadata_items[2].text.strip() if len(metadata_items) > 2 else "N/A"

    # 4. Summary
    summary_tag = item.select_one(".ipc-html-content-inner-div")
    data["Summary"] = summary_tag.text.strip() if summary_tag else "N/A"

    # 5. SMART TEXT SEARCH for Director / Stars / Genre
    # We flatten the entire card into a text string and search for keywords.
    # We use a separator '|' to keep sections distinct.
    full_text = item.get_text(separator="|", strip=True)
    
    # Default values
    data["Director"] = "N/A"
    data["Stars"] = "N/A"
    data["Genre"] = "N/A"
    
    # Find Director
    # Regex looks for "Director|Name" or "Director:|Name"
    dir_match = re.search(r"Director(?:s)?[:|]\s*([^|]+)", full_text)
    if dir_match:
        data["Director"] = dir_match.group(1).strip()
        
    # Find Stars
    # Regex looks for "Stars|Name1, Name2"
    stars_match = re.search(r"Star(?:s)?[:|]\s*([^|]+(?:\|[^|]+){0,3})", full_text)
    if stars_match:
        # Clean up the pipe separators back to commas
        raw_stars = stars_match.group(1).replace('|', ', ').strip()
        # Cut off if it accidentally grabbed the 'Votes' section
        if "Vote" in raw_stars:
            raw_stars = raw_stars.split("Vote")[0]
        data["Stars"] = raw_stars.strip(', ')

    # Find Genre (Tricky on new layout, often hidden. We check strict metadata selectors first)
    # If not found, we sometimes find it in the metadata row if we look deeper
    # Note: IMDb List View often HIDES Genre completely now. 
    # If this returns N/A, it means IMDb is not sending the Genre text in the List View.
    
    return data

def scrape_list(url, universe_name):
    print(f"Scraping {universe_name}...")
    soup = get_soup(url)
    if not soup: return []

    movies_data = []
    
    # Select the new list items
    items = soup.select("li.ipc-metadata-list-summary-item")
    print(f"  > Detected {len(items)} items.")

    for item in items:
        info = parse_new_layout(item)
        info["Universe"] = universe_name
        movies_data.append(info)
        
    return movies_data

def generate_excel():
    print("--- STARTING SMART SCRAPER ---")
    
    # PATH FIXER
    script_location = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_location, "Movies_Output.xlsx")
    
    marvel_url = "https://www.imdb.com/list/ls000024621/"
    dc_url = "https://www.imdb.com/list/ls000024643/"

    all_data = []
    all_data.extend(scrape_list(marvel_url, "Marvel"))
    time.sleep(1)
    all_data.extend(scrape_list(dc_url, "DC Comics"))

    if not all_data:
        print("CRITICAL ERROR: No data found.")
        return

    df = pd.DataFrame(all_data)
    
    # Calculate Score & Sort
    df = calculate_weighted_score(df)
    df = df.sort_values(by="Weighted Score", ascending=False)

    try:
        with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='MovieData', index=False)
            
            workbook = writer.book
            worksheet = writer.sheets['MovieData']
            
            # Format Score Column
            score_fmt = workbook.add_format({'num_format': '0.00', 'bold': True, 'bg_color': '#DDEBF7'})
            worksheet.set_column('J:J', 12, score_fmt) # Adjusted assumption for column J
            
            for i, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
                worksheet.set_column(i, i, max_len)
                
        print(f"SUCCESS: Saved data to {output_file}")
        
    except Exception as e:
        print(f"ERROR Saving Excel: {e}")

if __name__ == "__main__":
    generate_excel()