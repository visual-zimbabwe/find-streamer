# Running the IMDb Scrapers

Open PowerShell in this folder:

```powershell
cd D:\Dev\labs\find-streamer\mobile-app\IMDB
```

Install the Python dependencies:

```powershell
python -m pip install selenium webdriver-manager beautifulsoup4 pandas openpyxl xlsxwriter requests
```

Run the scrapers:

```powershell
python movie_scraper.py
python tv_scraper.py
```

Notes:

- Keep Chrome installed and updated.
- The scripts can take a long time because they loop through many IMDb chart pages.
- IMDb may block automated requests with an AWS WAF/challenge page, which causes the scripts to find zero items.
