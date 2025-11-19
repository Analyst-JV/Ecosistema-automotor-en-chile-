# Ecosistema Automovilístico en Chile 🚗📊  

Repositorio personal con **tres proyectos de datos separados**, todos en torno al ecosistema automotor en Chile:

1. **VentasExtract (App web)** → extracción inteligente de tablas de ventas de autos desde PDFs de la **ANAC**.
2. **ETL Accidentes de tránsito (`ETL_API.ipynb`)** → descarga y limpieza de series de accidentes de tránsito en Chile via API (aprox. 2018–2024, con 2020 excluido por anomalías).
3. **ETL Licencias y Permisos (`ETL_licencias_Permisos.ipynb`)** → integración y limpieza de bases del **INE** sobre licencias de conducir y permisos de circulación.

> Importante: los tres módulos son **independientes**.  
> La app web **VentasExtract solo trabaja con PDFs de ventas ANAC**.  
> Los notebooks de ETL funcionan como proyectos separados de análisis de datos.

---

## 1) VentasExtract 🚗📄  
_App web para extracción de PDFs de ventas automotrices (ANAC)_

### 1.1 Contexto y objetivos

En Chile, buena parte de la información del **mercado automotor** (ventas a público, marcas, evolución mensual, etc.) se publica en **informes PDF** de la ANAC.  
Estos documentos son útiles, pero:

* No son fáciles de convertir a tablas.
* Cambian de formato según el año.
* Mezclan texto, tablas y gráficos.

**VentasExtract** nace para atacar **solo este problema puntual**:

> Pasar de **PDFs de la ANAC** a **datasets limpios de “Ventas a público por marca”**, listos para BI, análisis de mercado o modelamiento.

Objetivos:

* **Descargar y organizar** automáticamente los reportes históricos.
* **Detectar y extraer las tablas de “Ventas a público por marca”** con ayuda de IA.
* **Estandarizar y limpiar** la información (fechas, marcas, columnas).
* Dejar un flujo reproducible para **Analistas de Datos / BI / Data Analytics**.

---

### 1.2 Qué demuestra VentasExtract (para reclutadores)

* 🕷️ **Scraping automatizado** de PDFs oficiales con **Selenium**.
* 📄 **Extracción “inteligente” de tablas** combinando:
  * búsqueda de texto en el PDF,
  * análisis visual con IA (Gemini).
* 💻 **Aplicación React** tipo “producto de datos”:
  * carga de PDFs,
  * cola de procesamiento con estados,
  * vista de resultados y exportación a CSV.
* 📦 Todo orientado a que otro analista tome el CSV y construya dashboards o modelos.

---

### 1.3 Alcance de los datos (VentasExtract)

* Solo trabaja con **PDFs de estudios de mercado de la ANAC**:
  * por **año y mes**.
* Tablas de **“Ventas a público por marca”** detectadas dentro de cada archivo.
* Atributos generados:
  * Año y mes de referencia.
  * Marca.
  * Columnas numéricas de ventas / participación (dependen del diseño de cada PDF).

No incluye licencias, permisos ni accidentes:  
eso se maneja en los notebooks descritos más abajo.

---

### 1.4 Metodología de extracción

#### 1.4.1 Descarga de PDFs (`Extractor_pdf.py`)

El script:

* Navega a la sección de **estudios de mercado** de la ANAC.
* Recorre los años definidos en una lista (`["2025","2024","2023", ...]`).
* Selecciona el año en el sitio y detecta los **links a PDFs**.
* Descarga los archivos en modo **headless**, controlando:
  * carpeta de destino,
  * fin real de las descargas (espera a que desaparezcan `.crdownload`),
  * evitar duplicados.

Tecnologías:

* `selenium` + `webdriver_manager`.
* `WebDriverWait` + `expected_conditions` (en lugar de `sleep` a ciegas).
* Configuración avanzada de Chrome (user agent, directorio de descargas).

---

#### 1.4.2 App React: extracción asistida por IA

Flujo principal de la app `VentasExtract`:

1. **Subir archivos PDF**

   Pantalla “Importar Datos”:

   * Arrastrar y soltar múltiples PDFs.
   * Cola de procesamiento con estado:
     * Pendiente
     * Procesando (con página actual)
     * Completado / Error.

2. **Modo de extracción**

   * **Solo Ventas Público**  
     * Escaneo de texto rápido desde la página 4 buscando  
       `VENTAS A PÚBLICO POR MARCA`.
     * Cuando se encuentra esa sección, se pasa a análisis **visual con IA**.
     * Detecta la **secuencia continua** de tablas de ventas y se detiene al dejar de encontrar tablas (optimiza tiempo/tokens).

   * **Todas las Tablas**  
     * Recorre todo el documento buscando tablas relevantes de ventas, sin depender del título anterior.

3. **Análisis página a página**

   * `convertPdfPageToImage(file, pageNum)` → convierte la página a imagen (base64).
   * `analyzePdfPage(imageBase64, extractionMode)` → servicio que:
     * indica si halló una tabla (`result.found`);
     * devuelve año, mes, filas de la tabla;
     * indica si es continuación de la tabla anterior.

   Cada tabla se guarda con:

   * `id`
   * `originalFileName`
   * `year`, `month`, `formattedDate` (ej: `"Enero 2019"`)
   * `rows` (filas ya aplanadas)
   * `isPart2`
   * `pageNumber`

4. **Exportación**

   * Exportación a **CSV consolidado** con todas las tablas detectadas.
   * Listo para usar en Power BI, Tableau, Python, etc.

---

## 2) ETL Accidentes de Tránsito (`ETL_API.ipynb`) 🚑📉  

Proyecto **separado de la app React**, centrado en la construcción de una **serie de tiempo de accidentes de tránsito en Chile**.

### 2.1 Alcance

* Consumo de la **API oficial** de seguridad vial (CONASET / organismos asociados).
* Rango de años aprox.: **2018–2024** (ajustable).
* **Año 2020 excluido por defecto**:
  * presenta anomalías fuertes (pandemia, cambios de movilidad),
  * se documenta la decisión en el notebook,
  * se deja configurado para que quien quiera pueda **activar 2020** cambiando un parámetro.

### 2.2 Qué hace el notebook

Pasos principales:

1. Conexión a la API y descarga de los datos por año / periodo.
2. Manejo de:
   * paginación / límites de la API (según corresponda),
   * almacenamiento intermedio en tablas.
3. Limpieza:
   * normalización de fechas y horas,
   * homogenización de códigos de tipo de accidente, gravedad, etc.
4. Unificación:
   * construcción de un **dataset histórico único** de accidentes,
   * preparado para análisis temporal, regional, por tipo de siniestro, etc.



---

## 3) ETL Licencias y Permisos (`ETL_licencias_Permisos.ipynb`) 🪪🚘  

Proyecto independiente que trabaja solo con **bases del INE** (licencias de conducir y permisos de circulación). No tiene relación directa con la app React.

### 3.1 Alcance

* Lectura de bases del INE en formatos tipo **ACCDB/DB** y archivos separados por año/segmento.
* Integración de:
  * **licencias de conducir**,
  * **permisos de circulación**,
  * **diccionarios de datos** cuando vienen en archivos separados.
* Homologación de:
  * nombres de columnas,
  * tipos de datos,
  * categorías relevantes (según disponibilidad: tipo de vehículo, región/comuna, etc.).

### 3.2 Flujo general

1. Carga de múltiples archivos crudos (por año / tipo).
2. Unión de tablas fragmentadas.
3. Aplicación de diccionarios de datos.
4. Limpieza de:
   * fechas,
   * variables categóricas,
   * códigos,
   * valores nulos o inconsistentes.
5. Generación de un **dataset limpio** listo para análisis de parque vehicular, licencias, etc.


---

## 4) Cómo usar cada módulo (resumen rápido)

1. **VentasExtract (PDFs ANAC)**
   - Ejecutar `Extractor_pdf.py` para descargar PDFs.
   - Levantar la app React.
   - Subir PDFs, elegir modo de extracción y exportar CSV.

2. **ETL Accidentes (`ETL_API.ipynb`)**
   - Abrir el notebook.
   - Configurar credenciales/parámetros de la API si es necesario.
   - Ejecutar todas las celdas para generar el dataset histórico (por defecto sin 2020, pero parametrizable).

3. **ETL Licencias & Permisos (`ETL_licencias_Permisos.ipynb`)**
   - Descargar las bases del INE (ver sección de datos más abajo).
   - Ajustar rutas a los archivos.
   - Ejecutar el notebook para obtener el dataset limpio final.

---
