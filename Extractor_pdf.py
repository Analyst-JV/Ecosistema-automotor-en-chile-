from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time

BASE_URL = "https://www.anac.cl/category/estudio-de-mercado/"
ANIOS = ["2025","2024","2023","2022","2021","2020","2019","2018"] #cambia el rango segun tu preferencia 

download = Path(r"C Colocar su direccion path de la carpeta donde quieren los archivos")
download.mkdir(parents=True, exist_ok=True)

opts = Options()
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_argument("--headless=new")
opts.add_argument("--window-size=1920,1080")
#  Importante este User-Agent ES genérico para simular un navegador "normal" cambialo por tu navegador 
opts.add_argument(
    "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

opts.page_load_strategy = "eager"

prefs = {
    "download.default_directory": str(download),
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True,
    "profile.default_content_setting_values.automatic_downloads": 1,
}
opts.add_experimental_option("prefs", prefs)

service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=opts)
wait = WebDriverWait(driver, 20)

# En algunas versiones headless esto asegura la descarga al path indicado
try:
    driver.execute_cdp_cmd("Page.setDownloadBehavior", {
        "behavior": "allow",
        "downloadPath": str(download)
    })
except Exception:
    pass  # si no está disponible, seguimos con prefs

def abrir_pagina_categoria():
    driver.get(BASE_URL)
    wait.until(EC.presence_of_element_located((By.ID, "annoselector")))
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href$=".pdf"]')))

def esperar_descargas_terminadas(timeout=180):
    fin = time.time() + timeout
    # Espera a que NO existan archivos .crdownload (descargas en curso)
    while time.time() < fin:
        if not any(download.glob("*.crdownload")):
            return
        time.sleep(0.5)
    raise TimeoutError("Las descargas no finalizaron dentro del tiempo esperado.")

descargados = set()

try:
    abrir_pagina_categoria()

    for anio in ANIOS:
        # Cambiar al año
        Select(driver.find_element(By.ID, "annoselector")).select_by_visible_text(anio)
        # Espera a que carguen PDFs de ese año
        wait.until(EC.presence_of_element_located(
            (By.XPATH, f'//a[contains(@href, "/{anio}/") and contains(@href, ".pdf")]')
        ))

        # Recoger enlaces PDF únicos de ese año
        anchors = driver.find_elements(By.CSS_SELECTOR, 'a[href$=".pdf"]')
        links = {a.get_attribute("href") for a in anchors if a.get_attribute("href")}
        links = [u for u in links if f"/{anio}/" in u and u not in descargados]

        for url in links:
            driver.get(url)  # dispara la descarga
            # pequeño tick para que aparezca el .crdownload
            time.sleep(0.2)
            esperar_descargas_terminadas(timeout=90)
            print("Descargado:", url)
            descargados.add(url)

        # Volver a la categoría para el siguiente año
        abrir_pagina_categoria()

finally:
    driver.quit()
