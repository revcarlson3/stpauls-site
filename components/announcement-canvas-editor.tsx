"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Canvas, Circle, FabricImage, Line, Point, Polygon, Rect, Shadow, Textbox, Triangle, type FabricObject } from "fabric";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";
import { ANNOUNCEMENT_SHAPES, announcementCanvasDropPoint, announcementDocumentToHtml, announcementShapePoints, centeredAnnouncementPosition, defaultAnnouncementDocument, type AnnouncementDocument, type AnnouncementElement, type AnnouncementPage, type AnnouncementShape } from "@/lib/announcement-document";

type MediaAsset = { id: string; originalName: string; url: string; mimeType: string; altText: string | null; title: string | null };

type LayoutCategory = "text" | "images" | "shapes" | "tables" | "grids";

type CanvasObject = FabricObject & {
  announcementId?: string;
  announcementType?: AnnouncementElement["type"];
  announcementAlt?: string;
  announcementCornerRadius?: number;
  announcementStroke?: string;
  announcementStrokeWidth?: number;
  announcementShape?: AnnouncementShape;
  announcementContainer?: "table" | "grid";
  announcementCellId?: string;
  announcementLayoutId?: string;
  announcementLayoutType?: "table" | "grid";
  announcementLayoutRows?: number;
  announcementLayoutColumns?: number;
  announcementLayoutGap?: number;
  announcementCellRow?: number;
  announcementCellColumn?: number;
  announcementGuide?: boolean;
  announcementLink?: string;
};

type SelectedObject = {
  id: string;
  type: AnnouncementElement["type"];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  fontStyle?: "normal" | "bold" | "italic";
  underline?: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  link?: string;
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  stroke?: string;
  strokeWidth?: number;
  shape?: AnnouncementShape;
  layoutId?: string;
  layoutType?: "table" | "grid";
  layoutGap?: number;
  layoutRows?: number;
  layoutColumns?: number;
  cellRow?: number;
  cellColumn?: number;
};

const COMMONLY_USED_FONTS = ["Arial", "Georgia", "Roboto", "Open Sans", "Montserrat", "Poppins"];
const COMMON_FONTS = ["Verdana", "Trebuchet MS", "Courier New", "Tahoma", "Times New Roman", "Impact", "Helvetica", "Garamond"];
const GOOGLE_FONTS = [
  "ABeeZee", "Abel", "Abhaya Libre", "Abril Fatface", "Açık Sans", "Aclonica", "Acme", "Actor", "Adamina", "Advent Pro", "Afacad", "Afacad Flux", "Agdasima", "Aguafina Script", "Akaya Kanadaka", "Akaya Telivigala", "Alata", "Alatsi", "Albert Sans", "Aldrich", "Alef", "Alegreya", "Alegreya Sans", "Alegreya Sans SC", "Alegreya SC", "Alex Brush", "Alexandria", "Alfa Slab One", "Alice", "Alike", "Alkatra", "Allan", "Allerta", "Allerta Stencil", "Allison", "Allura", "Almarai", "Alumni Sans", "Amatic SC", "Amiri", "Amita", "Anaheim", "Andada Pro", "Andika", "Anton", "Antonio", "Arapey", "Arbutus", "Arbutus Slab", "Architects Daughter", "Archivo", "Archivo Black", "Archivo Narrow", "Aref Ruqaa", "Arima", "Arimo", "Arizonia", "Armata", "Arsenal", "Artifika", "Arvo", "Arya", "Asap", "Asap Condensed", "Asar", "Asset", "Assistant", "Astloch", "Asul", "Athiti", "Atkinson Hyperlegible", "Aubrey", "Audiowide", "Autour One", "Average", "Average Sans", "Averia Libre", "B612", "Bai Jamjuree", "Balsamiq Sans", "Barlow", "Barlow Condensed", "Barlow Semi Condensed", "Barriecito", "Be Vietnam Pro", "Bebas Neue", "Belanosima", "Bellefair", "Belleza", "Bellota", "BenchNine", "Berkshire Swash", "Besley", "Bitter", "Black Han Sans", "Bodoni Moda", "Bokor", "Bona Nova", "Bonbon", "Boogaloo", "Bowlby One", "Bowlby One SC", "Brawler", "Bree Serif", "Bruno Ace", "Brygada 1918", "Bubblegum Sans", "Buda", "Buenard", "Cabin", "Cabin Condensed", "Cabin Sketch", "Cairo", "Cairo Play", "Candal", "Cantarell", "Caprasimo", "Caramel", "Cardo", "Carme", "Carrois Gothic", "Carter One", "Castoro", "Catamaran", "Caudex", "Caveat", "Caveat Brush", "Ceviche One", "Chakra Petch", "Changa", "Chau Philomene One", "Chivo", "Chonburi", "Cinzel", "Cinzel Decorative", "Clicker Script", "Coda", "Coda Caption", "Codystar", "Comfortaa", "Comic Neue", "Comme", "Concert One", "Condiment", "Content", "Contrail One", "Convergence", "Cookie", "Cormorant", "Cormorant Garamond", "Courgette", "Courier Prime", "Cousine", "Crimson Pro", "Croissant One", "Cubic", "Cuprum", "Dancing Script", "Danfo", "Dangrek", "Darker Grotesque", "DM Mono", "DM Sans", "DM Serif Display", "DM Serif Text", "Delius", "Delius Swash Caps", "Denk One", "Devonshire", "Dhurjati", "Didact Gothic", "Diphylleia", "Diplomata", "Do Hyeon", "Dokdo", "Domine", "Donegal One", "Doppio One", "Dorsa", "Dosis", "Dr Sugiyama", "Duru Sans", "Dynalight", "Eagle Lake", "East Sea Dokdo", "Eater", "Economica", "Eczar", "Edu AU VIC WA NT Hand", "El Messiri", "Electrolize", "Elsie", "Emblema One", "Emilys Candy", "Encode Sans", "Encode Sans Condensed", "Encode Sans Expanded", "Engagement", "Englebert", "Enriqueta", "Ephesis", "Epilogue", "Erica One", "Esteban", "Euphoria Script", "Ewert", "Exo", "Exo 2", "Fahkwang", "Fajar One", "Falkon", "Fasthand", "Faustina", "Federant", "Federo", "Felipa", "Fenix", "Festive", "Finger Paint", "Fira Code", "Fira Mono", "Fira Sans", "Fira Sans Condensed", "Fjalla One", "Fjord One", "Flamenco", "Flavors", "Fondamento", "Fontdiner Swanky", "Forum", "Francois One", "Frank Ruhl Libre", "Fraunces", "Freckle Face", "Fredericka the Great", "Fredoka", "Freehand", "Fresca", "Frijole", "Fugaz One", "Fuggles", "Funnel Display", "Funnel Sans", "Gabriela", "Gaegu", "Gafata", "Galada", "Galdeano", "Galindo", "Gamja Flower", "Gantari", "Gasoek One", "Gatte Sans", "Gelasio", "Gemunu Libre", "Genos", "Gentium Book Plus", "Geo", "Geologica", "Georama", "Germania One", "Gideon Roman", "Girassol", "Give You Glory", "Gloria Hallelujah", "Goblin One", "Gochi Hand", "Goldman", "Gorditas", "Gothic A1", "Gotu", "Goudy Bookletter 1911", "Graduate", "Grand Hotel", "Grandstander", "Grape Nuts", "Gravitas One", "Great Vibes", "Grenze", "Grey Qo", "Griffy", "Gruppo", "Gudea", "Gugi", "Gulzar", "Gupter", "Habibi", "Halant", "Hammersmith One", "Hanken Grotesk", "Hanuman", "Happy Monkey", "Harmattan", "Headland One", "Heebo", "Henny Penny", "Hepta Slab", "Herr Von Muellerhoff", "Hi Melody", "Hina Mincho", "Hind", "Hind Madurai", "Hind Siliguri", "Holtwood One SC", "Homemade Apple", "Homenaje", "IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif", "IM Fell English", "IM Fell French Canon", "Inconsolata", "Inder", "Indie Flower", "Ingrid Darling", "Inika", "Inknut Antiqua", "Inria Sans", "Inria Serif", "Instrument Sans", "Instrument Serif", "Inter", "Irish Grover", "Island Moments", "Italiana", "Italianno", "Jacques Francois", "Jaldi", "Jaro", "Josefin Sans", "Josefin Slab", "Jost", "Joti One", "Jua", "Judson", "Julee", "Junge", "Jura", "Just Another Hand", "Kalam", "Kameron", "Kanit", "Karla", "Karma", "Katibeh", "Kaushan Script", "Kavoon", "Kdam Thmor Pro", "Keania One", "Kelly Slab", "Kenia", "Khand", "Khmer", "Kite One", "Knewave", "Kodchasan", "Koh Santepheap", "Kolker Brush", "Konna", "Kotta One", "Koulen", "Kranky", "Krona One", "Krub", "Kufam", "Kulim Park", "Kumar One", "Kurale", "La Belle Aurore", "Lacquer", "Laila", "Lakki Reddy", "Lalezar", "Lancelot", "Langar", "Lateef", "Lato", "Lavishly Yours", "League Gothic", "League Spartan", "Leckerli One", "Ledger", "Lekton", "Lemon", "Lemonada", "Lexend", "Libre Baskerville", "Libre Bodoni", "Libre Caslon Display", "Libre Caslon Text", "Life Savers", "Lilita One", "Limelight", "Linden Hill", "Lisu Bosa", "Literata", "Liu Jian Mao Cao", "Livvic", "Lobster", "Lobster Two", "Londrina Solid", "Long Cang", "Lora", "Love Ya Like A Sister", "Loved by the King", "Lovers Quarrel", "Luckiest Guy", "Lusitana", "Lustria", "M PLUS 1", "M PLUS Rounded 1c", "Macondo", "Mada", "Madimi One", "Magra", "Maiden Orange", "Maitree", "Major Mono Display", "Mako", "Manjari", "Manrope", "Mansalva", "Manuale", "Marcellus", "Marck Script", "Margarine", "Markazi Text", "Martel", "Martel Sans", "Marvel", "Mate", "Maven Pro", "Merienda", "Merriweather", "Merriweather Sans", "Metal", "Metrophobic", "Michroma", "Milonga", "Miltonian", "Mina", "Mingzat", "Miniver", "Miriam Libre", "Mitr", "Mochiy Pop One", "Modak", "Modern Antiqua", "Moirai One", "Molengo", "Molle", "Monda", "Monoton", "Monsieur La Doulaise", "Montaga", "Montagu Slab", "MonteCarlo", "Montserrat", "Montserrat Alternates", "Montserrat Subrayada", "Moo Lah Lah", "Mooli", "Moon Dance", "Moul", "M PLUS 1 Code", "Mulish", "Murecho", "MuseoModerno", "My Soul", "Mystery Quest", "Nabla", "Nanum Gothic", "Neonderthaw", "Neuton", "New Rocker", "News Cycle", "Niconne", "Niramit", "Nixie One", "Nobile", "Nokora", "Norican", "Nosifer", "Notable", "Nothing You Could Do", "Noticia Text", "Noto Sans", "Noto Serif", "Nova Cut", "Nova Flat", "Nova Mono", "Nova Oval", "Numans", "Nunito", "Nunito Sans", "Odibee Sans", "Offside", "Oi", "Old Standard TT", "Oldenburg", "Oleo Script", "Onest", "Open Sans", "Orbitron", "Orienta", "Original Surfer", "Oswald", "Outfit", "Overlock", "Overpass", "Oxygen", "Pacifico", "Padauk", "Palanquin", "Palanquin Dark", "Pangolin", "Paprika", "Parisienne", "Passero One", "Passion One", "Pathway Gothic One", "Patrick Hand", "Pattaya", "Paytone One", "Peddana", "Peralta", "Permanent Marker", "Petemoss", "Petit Formal Script", "Philosopher", "Piazzolla", "Piedra", "Pinyon Script", "Pirata One", "Plaster", "Play", "Playball", "Playfair Display", "Plus Jakarta Sans", "Podkova", "Poiret One", "Poller One", "Poly", "Pompiere", "Pontano Sans", "Poor Story", "Poppins", "Port Lligat Slab", "Prata", "Press Start 2P", "Pridi", "Princess Sofia", "Prociono", "Prompt", "Prosto One", "Proza Libre", "Public Sans", "Qahiri", "Quantico", "Quattrocento", "Quattrocento Sans", "Questrial", "Quicksand", "Quintessential", "Qwigley", "Racing Sans One", "Radley", "Rajdhani", "Rakkas", "Raleway", "Raleway Dots", "Ramabhadra", "Ramaraja", "Ranchers", "Rancho", "Ranga", "Rasa", "Rationale", "Ravi Prakash", "Readex Pro", "Recursive", "Red Hat Display", "Red Hat Mono", "Red Hat Text", "Red Rose", "Reem Kufi", "Reem Kufi Fun", "Reenie Beanie", "Revalia", "Rhodium Libre", "Ribeye", "Ribeye Marrow", "Righteous", "Risque", "Road Rage", "Roboto", "Roboto Condensed", "Roboto Mono", "Roboto Slab", "Rochester", "Rock Salt", "Rokkitt", "Romanesco", "Ropa Sans", "Rosario", "Rothko", "Rouge Script", "Rowdies", "Rozha One", "Rubik", "Rubik Dirt", "Ruda", "Rufina", "Ruge Boogie", "Ruluko", "Rum Raisin", "Ruslan Display", "Russo One", "Saira", "Saira Condensed", "Salsa", "Sanchez", "Sancreek", "Sansita", "Sarabun", "Sarala", "Satisfy", "Schoolbell", "Scope One", "Seaweed Script", "Secular One", "Send Flowers", "Shadows Into Light", "Shantell Sans", "Share", "Share Tech", "Share Tech Mono", "Shippori Mincho", "Shizuru", "Short Stack", "Shrikhand", "Siemreap", "Signika", "Silkscreen", "Simonetta", "Six Caps", "Skranji", "Slabo 13px", "Slabo 27px", "Slackside One", "Smokum", "Smooch", "Sofia", "Sofia Sans", "Solitreo", "Sonsie One", "Space Grotesk", "Space Mono", "Special Elite", "Spectral", "Spicy Rice", "Spinnaker", "Spirax", "Squada One", "Square Peg", "Sriracha", "Staatliches", "Stardos Stencil", "Stint Ultra Condensed", "Stoke", "Strait", "Style Script", "Sue Ellen Francisco", "Suez One", "Sulphur Point", "Sumana", "Sunflower", "SUSE", "Swanky and Moo Moo", "Syncopate", "Tajawal", "Tangerine", "Teko", "Telex", "Tenali Ramakrishna", "Tenor Sans", "Text Me One", "The Girl Next Door", "Tienne", "Tilt Neon", "Tinos", "Tiny5", "Tiro Bangla", "Tiro Devanagari Hindi", "Tiro Tamil", "Titan One", "Titillium Web", "Tourney", "Trade Winds", "Trirong", "Trocchi", "Trochut", "Trykker", "Tulpen One", "Ubuntu", "Ubuntu Condensed", "Ubuntu Mono", "Ultra", "Unbounded", "Uncial Antiqua", "Underdog", "Unica One", "UnifrakturCook", "Unlock", "Unna", "Updock", "Urbanist", "Varela", "Varela Round", "Vast Shadow", "Vesper Libre", "Viaoda Libre", "Vibes", "Vibur", "Victor Mono", "Vidaloka", "Viga", "Vina Sans", "Wix Madefor Display", "Wix Madefor Text", "Work Sans", "Xanh Mono", "Yaldevi", "Yanone Kaffeesatz", "Yellowtail", "Ysabeau", "ZCOOL KuaiLe", "Zeyada", "Zilla Slab"
];
const FONT_SIZES = Array.from({ length: 87 }, (_, index) => index + 8);
const PAGE_PRESETS = [
  { label: "Portrait (900 × 1200 px)", width: 900, height: 1200 },
  { label: "Square (1080 × 1080 px)", width: 1080, height: 1080 },
  { label: "Instagram portrait (1080 × 1350 px)", width: 1080, height: 1350 },
  { label: "Letter (8.5 × 11 in)", width: 816, height: 1056 },
  { label: "A4 (210 × 297 mm)", width: 794, height: 1123 },
  { label: "Landscape (1200 × 900 px)", width: 1200, height: 900 }
];
const TABLE_PRESETS = [
  { value: "header", label: "Header row", rows: 4, columns: 3, headerRows: 1, headerColumns: 0, fill: "#fffaf2", headerFill: "#17324d", stroke: "#d6d9df" },
  { value: "banded", label: "Banded rows", rows: 5, columns: 3, headerRows: 1, headerColumns: 0, fill: "#ffffff", headerFill: "#e66f51", stroke: "#d6d9df" },
  { value: "headers", label: "Header row + column", rows: 4, columns: 4, headerRows: 1, headerColumns: 1, fill: "#fffaf2", headerFill: "#17324d", stroke: "#d6d9df" },
  { value: "plain", label: "Plain grid", rows: 5, columns: 4, headerRows: 0, headerColumns: 0, fill: "#ffffff", headerFill: "#ffffff", stroke: "#aeb6c2" }
] as const;
const GRID_PRESETS = [
  { value: "2x2", label: "2 × 2 cards", rows: 2, columns: 2, gap: 18 },
  { value: "3x2", label: "3 × 2 cards", rows: 2, columns: 3, gap: 14 },
  { value: "2x3", label: "2 × 3 cards", rows: 3, columns: 2, gap: 14 },
  { value: "4x1", label: "4 columns", rows: 1, columns: 4, gap: 12 },
  { value: "photo", label: "Photo grid", rows: 3, columns: 3, gap: 8 },
  { value: "header", label: "Header + cards", rows: 3, columns: 2, gap: 14, headerRows: 1 },
  { value: "footer", label: "Cards + footer", rows: 3, columns: 2, gap: 14, footerRows: 1 },
  { value: "asymmetric", label: "Asymmetric columns", rows: 2, columns: 3, gap: 14, columnWeights: [1, 2, 1] }
] as const;

function pageList(document: AnnouncementDocument) {
  return document.pages?.length ? document.pages : [{ id: "page-1", width: document.width, height: document.height, background: document.background, elements: document.elements }];
}

function withPage(document: AnnouncementDocument, index: number, page: AnnouncementPage) {
  const pages = pageList(document).map((item, pageIndex) => pageIndex === index ? page : item);
  const first = pages[0] ?? page;
  return { ...document, width: first.width, height: first.height, background: first.background, elements: first.elements, pages };
}

function googleFontUrl(font: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}:wght@400;700&display=swap`;
}

function shapeObject(element: Extract<AnnouncementElement, { type: "rect" }>) {
  const common = { left: element.x, top: element.y, originX: "left" as const, originY: "top" as const, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth, transparentCorners: false, cornerColor: "#e66f51" };
  if (element.shape === "circle") return new Circle({ ...common, radius: 50, scaleX: element.width / 100, scaleY: element.height / 100 });
  if (element.shape === "triangle") return new Triangle({ ...common, width: element.width, height: element.height });
  const points = announcementShapePoints(element.shape ?? "rect");
  if (points.length) return new Polygon(points.map(([x, y]) => ({ x, y })), { ...common, scaleX: element.width / 100, scaleY: element.height / 100 });
  return new Rect({ ...common, width: element.width, height: element.height, rx: element.cornerRadius, ry: element.cornerRadius });
}

function positionShapeObject(object: FabricObject, element: Extract<AnnouncementElement, { type: "rect" }>) {
  object.set({ originX: "center", originY: "center" });
  object.setPositionByOrigin(new Point(element.x + element.width / 2, element.y + element.height / 2), "center", "center");
  object.setCoords();
}

function canvasObject(object: FabricObject) {
  return object as CanvasObject;
}

function objectTopLeft(object: FabricObject) {
  const item = canvasObject(object);
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  if (item.announcementType === "rect" && object.originX === "center" && object.originY === "center") {
    return { x: numberValue(object.left, 0) - width / 2, y: numberValue(object.top, 0) - height / 2 };
  }
  return { x: numberValue(object.left, 0), y: numberValue(object.top, 0) };
}

function numberValue(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value as number : fallback;
}

function selectedObject(object: FabricObject | undefined): SelectedObject | null {
  if (!object) return null;
  const item = canvasObject(object);
  const id = item.announcementId;
  const type = item.announcementType;
  if (!id || !type) return null;
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string; underline?: boolean };
  return {
    id,
    type,
    text: textObject.text,
    fontSize: textObject.fontSize,
    fontFamily: textObject.fontFamily,
    fill: typeof object.fill === "string" ? object.fill : undefined,
    align: textObject.textAlign,
    fontStyle: textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal",
    underline: textObject.underline === true,
    opacity: numberValue(object.opacity, 1),
    x: objectTopLeft(object).x,
    y: objectTopLeft(object).y,
    width,
    height,
    link: (item as CanvasObject & { announcementLink?: string }).announcementLink,
    shadow: object.shadow ? { color: String((object.shadow as Shadow).color ?? "#00000066"), blur: Number((object.shadow as Shadow).blur ?? 0), offsetX: Number((object.shadow as Shadow).offsetX ?? 0), offsetY: Number((object.shadow as Shadow).offsetY ?? 0) } : undefined,
    stroke: typeof object.stroke === "string" ? object.stroke : undefined,
    strokeWidth: numberValue(object.strokeWidth, 0),
    shape: item.announcementShape,
    layoutId: item.announcementLayoutId,
    layoutType: item.announcementLayoutType,
    layoutGap: item.announcementLayoutGap,
    layoutRows: item.announcementLayoutRows,
    layoutColumns: item.announcementLayoutColumns,
    cellRow: item.announcementCellRow,
    cellColumn: item.announcementCellColumn
  };
}

function documentFromCanvas(canvas: Canvas, value: AnnouncementDocument): AnnouncementDocument {
  const elements: AnnouncementElement[] = canvas.getObjects().filter((object) => !canvasObject(object).announcementGuide).map((object) => {
    const item = canvasObject(object);
    const type = item.announcementType;
    const id = item.announcementId;
    const position = objectTopLeft(object);
    const x = position.x;
    const y = position.y;
    const width = Math.max(1, object.getScaledWidth());
    const height = Math.max(1, object.getScaledHeight());
    if (type === "text" && id) {
      const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string; underline?: boolean };
      const shadow = object.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | undefined;
      return { id, type, x, y, width, height, text: (textObject.text ?? "").slice(0, 5000), fontSize: numberValue(textObject.fontSize, 24), fontFamily: (textObject.fontFamily ?? "Arial").slice(0, 80), fill: typeof object.fill === "string" ? object.fill : "#17324d", align: textObject.textAlign ?? "left", fontStyle: textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal", underline: textObject.underline === true, link: (item as CanvasObject & { announcementLink?: string }).announcementLink, shadow: shadow ? { color: shadow.color ?? "#00000066", blur: shadow.blur ?? 0, offsetX: shadow.offsetX ?? 0, offsetY: shadow.offsetY ?? 0 } : undefined, stroke: typeof object.stroke === "string" ? object.stroke : undefined, strokeWidth: numberValue(object.strokeWidth, 0), container: item.announcementContainer, cellId: item.announcementCellId, layoutId: item.announcementLayoutId, layoutType: item.announcementLayoutType, layoutGap: item.announcementLayoutGap, layoutRows: item.announcementLayoutRows, layoutColumns: item.announcementLayoutColumns, cellRow: item.announcementCellRow, cellColumn: item.announcementCellColumn };
    }
    if (type === "image" && id) {
      return { id, type, x, y, width, height, src: String((item as CanvasObject & { announcementSrc?: string }).announcementSrc ?? ""), alt: item.announcementAlt ?? "", cornerRadius: item.announcementCornerRadius ?? 0, container: item.announcementContainer, cellId: item.announcementCellId, layoutId: item.announcementLayoutId, layoutType: item.announcementLayoutType, layoutGap: item.announcementLayoutGap, layoutRows: item.announcementLayoutRows, layoutColumns: item.announcementLayoutColumns, cellRow: item.announcementCellRow, cellColumn: item.announcementCellColumn };
    }
    return { id: id ?? `shape-${Date.now()}`, type: "rect", x, y, width, height, fill: typeof object.fill === "string" ? object.fill : "#e66f51", cornerRadius: item.announcementCornerRadius ?? 0, shape: item.announcementShape ?? "rect", stroke: item.announcementStroke, strokeWidth: item.announcementStrokeWidth, container: item.announcementContainer, cellId: item.announcementCellId, layoutId: item.announcementLayoutId, layoutType: item.announcementLayoutType, layoutGap: item.announcementLayoutGap, layoutRows: item.announcementLayoutRows, layoutColumns: item.announcementLayoutColumns, cellRow: item.announcementCellRow, cellColumn: item.announcementCellColumn };
  });
  return { ...value, background: typeof canvas.backgroundColor === "string" ? canvas.backgroundColor : value.background, elements };
}

function setCanvasObjectMetadata(object: FabricObject, element: AnnouncementElement) {
  const item = canvasObject(object);
  item.announcementId = element.id;
  item.announcementType = element.type;
  if (element.type === "text") {
    (item as CanvasObject & { announcementLink?: string }).announcementLink = element.link;
  }
  if (element.type === "image") {
    item.announcementAlt = element.alt;
    item.announcementCornerRadius = element.cornerRadius;
    (item as CanvasObject & { announcementSrc?: string }).announcementSrc = element.src;
  }
  if (element.type === "rect") {
    item.announcementShape = element.shape ?? "rect";
    item.announcementCornerRadius = element.cornerRadius;
    item.announcementStroke = element.stroke;
    item.announcementStrokeWidth = element.strokeWidth;
  }
  if (element.container) {
    item.announcementContainer = element.container;
    item.announcementCellId = element.cellId;
  }
  item.announcementLayoutId = element.layoutId;
  item.announcementLayoutType = element.layoutType;
  item.announcementLayoutGap = element.layoutGap;
  item.announcementLayoutRows = element.layoutRows;
  item.announcementLayoutColumns = element.layoutColumns;
  item.announcementCellRow = element.cellRow;
  item.announcementCellColumn = element.cellColumn;
}

export function AnnouncementCanvasEditor({ value, onChange }: { value: AnnouncementDocument; onChange: (value: AnnouncementDocument) => void }) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const loadingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const loadedPageRef = useRef(0);
  const layoutMoveRef = useRef<{ id: string; startX: number; startY: number; positions: Map<string, { x: number; y: number }> } | null>(null);
  const lastDocumentRef = useRef(JSON.stringify(value));
  const lastEmittedRef = useRef(JSON.stringify(value));
  const [selected, setSelected] = useState<SelectedObject | null>(null);
  const [history, setHistory] = useState<AnnouncementDocument[]>([]);
  const [future, setFuture] = useState<AnnouncementDocument[]>([]);
  const [zoom, setZoom] = useState(0.72);
  const [activePage, setActivePage] = useState(0);
  const [layers, setLayers] = useState<AnnouncementElement[]>(value.elements);
  const [fontQuery, setFontQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: AnnouncementElement["type"] } | null>(null);
  const [insertCategory, setInsertCategory] = useState<LayoutCategory>("text");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const pages = pageList(value);
  const currentPage = pages[activePage] ?? pages[0];
  const [customWidth, setCustomWidth] = useState(String(currentPage?.width ?? value.width));
  const [customHeight, setCustomHeight] = useState(String(currentPage?.height ?? value.height));
  const [customUnit, setCustomUnit] = useState("px");

  const refreshSelection = useCallback(() => {
    const canvas = fabricRef.current;
    setSelected(selectedObject(canvas?.getActiveObject()));
    setLayers(canvas ? canvas.getObjects().map((object) => {
      const item = canvasObject(object);
      const element = currentPage.elements.find((candidate) => candidate.id === item.announcementId);
      if (element) return element;
      const base = { id: item.announcementId ?? "unknown", x: numberValue(object.left, 0), y: numberValue(object.top, 0), width: Math.max(1, object.getScaledWidth()), height: Math.max(1, object.getScaledHeight()) };
      if (item.announcementType === "text") {
        const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string };
        return { ...base, type: "text" as const, text: textObject.text ?? "Text", fontSize: numberValue(textObject.fontSize, 24), fontFamily: textObject.fontFamily ?? "Arial", fill: typeof object.fill === "string" ? object.fill : "#17324d", align: textObject.textAlign ?? "left", fontStyle: (textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal") as "normal" | "bold" | "italic" };
      }
      if (item.announcementType === "image") {
        return { ...base, type: "image" as const, src: "", alt: item.announcementAlt ?? "", cornerRadius: item.announcementCornerRadius ?? 0 };
      }
      return { ...base, type: "rect" as const, fill: typeof object.fill === "string" ? object.fill : "#e66f51", cornerRadius: item.announcementCornerRadius ?? 0, shape: item.announcementShape ?? "rect" };
    }).reverse() : value.elements);
  }, [currentPage.elements]);

  const publish = useCallback((next: AnnouncementDocument, recordHistory = true) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastEmittedRef.current) return;
    if (recordHistory) {
      const previous = JSON.parse(lastDocumentRef.current) as AnnouncementDocument;
      setHistory((items) => [...items.slice(-49), previous]);
      setFuture([]);
    }
    lastDocumentRef.current = serialized;
    lastEmittedRef.current = serialized;
    onChange(next);
  }, [onChange]);

  const syncFromCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || loadingRef.current) return;
    const nextPage = documentFromCanvas(canvas, { ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    publish(withPage(value, activePage, { ...currentPage, width: nextPage.width, height: nextPage.height, background: nextPage.background, elements: nextPage.elements }));
    refreshSelection();
  }, [activePage, currentPage, publish, refreshSelection, value]);

  const loadDocument = useCallback(async (document: AnnouncementDocument) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const requestId = ++loadRequestRef.current;
    loadingRef.current = true;
    canvas.clear();
    canvas.setDimensions({ width: document.width, height: document.height }, { cssOnly: false });
    canvas.lowerCanvasEl.style.width = `${document.width}px`;
    canvas.lowerCanvasEl.style.height = `${document.height}px`;
    canvas.upperCanvasEl.style.width = `${document.width}px`;
    canvas.upperCanvasEl.style.height = `${document.height}px`;
    canvas.backgroundColor = document.background;
    for (const element of document.elements) {
      if (requestId !== loadRequestRef.current || fabricRef.current !== canvas) return;
      if (element.type === "text") {
        const object = new Textbox(element.text, { left: element.x, top: element.y, originX: "left", originY: "top", width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, textAlign: element.align, fontWeight: element.fontStyle === "bold" ? "bold" : "normal", fontStyle: element.fontStyle === "italic" ? "italic" : "normal", underline: element.underline === true, editable: true, transparentCorners: false, cornerColor: "#e66f51", stroke: element.stroke, strokeWidth: element.strokeWidth, shadow: element.shadow ? new Shadow({ color: element.shadow.color, blur: element.shadow.blur, offsetX: element.shadow.offsetX, offsetY: element.shadow.offsetY }) : undefined });
        object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
        setCanvasObjectMetadata(object, element);
        canvas.add(object);
      } else if (element.type === "rect") {
        const object = shapeObject(element);
        positionShapeObject(object, element);
        setCanvasObjectMetadata(object, element);
        canvas.add(object);
      } else {
        try {
          const object = await FabricImage.fromURL(element.src, { crossOrigin: "anonymous" });
          object.set({ left: element.x, top: element.y, originX: "left", originY: "top", scaleX: element.width / Math.max(1, object.width ?? element.width), scaleY: element.height / Math.max(1, object.height ?? element.height), transparentCorners: false, cornerColor: "#e66f51" });
          setCanvasObjectMetadata(object, element);
          canvas.add(object);
        } catch {
          // Keep the rest of the document editable when an image cannot be loaded.
        }
      }
    }
    if (requestId !== loadRequestRef.current || fabricRef.current !== canvas) return;
    canvas.requestRenderAll();
    lastDocumentRef.current = JSON.stringify(document);
    lastEmittedRef.current = JSON.stringify(document);
    loadedPageRef.current = activePage;
    loadingRef.current = false;
    refreshSelection();
  }, [activePage, refreshSelection]);

  useEffect(() => {
    if (insertCategory !== "images") return;
    setMediaLoading(true);
    setMediaError("");
    void fetch("/api/media?type=image&context=site-settings", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load images.");
      setMediaAssets(Array.isArray(body) ? body as MediaAsset[] : []);
    }).catch((reason: unknown) => setMediaError(reason instanceof Error ? reason.message : "Unable to load images.")).finally(() => setMediaLoading(false));
  }, [insertCategory]);

  useEffect(() => {
    if (!canvasElementRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasElementRef.current, { width: value.width, height: value.height, preserveObjectStacking: true, selection: true });
    fabricRef.current = canvas;
    const handleModified = (event?: { target?: FabricObject }) => {
      if (event?.target) resizeGridLayout(event.target);
      syncFromCanvas();
    };
    const handleSelection = () => refreshSelection();
    const handleMoving = (event: { target?: FabricObject; e?: unknown }) => {
      const pointer = event.e as { shiftKey?: boolean } | undefined;
      if (event.target) {
        moveLayout(event.target);
        if (!pointer?.shiftKey) showGuides(event.target);
      }
    };
    const handleMouseUp = () => { clearGuides(); syncFromCanvas(); };
    const handleContext = (event: { target?: FabricObject; e?: { preventDefault: () => void; clientX: number; clientY: number } }) => {
      if (!event.target || canvasObject(event.target).announcementGuide) return;
      const item = canvasObject(event.target);
      if (item.announcementId && item.announcementType && event.e) {
        event.e.preventDefault();
        canvas.setActiveObject(event.target);
        setContextMenu({ x: event.e.clientX, y: event.e.clientY, type: item.announcementType });
        refreshSelection();
      }
    };
    const handleMouseDown = (event: { target?: FabricObject; e?: unknown }) => {
      const target = event.target;
      if (target) {
        const item = canvasObject(target);
        if (item.announcementLayoutId) {
          layoutMoveRef.current = {
            id: item.announcementLayoutId,
            startX: numberValue(target.left, 0),
            startY: numberValue(target.top, 0),
            positions: new Map(layoutObjects(item.announcementLayoutId).map((object) => [canvasObject(object).announcementId ?? "", { x: numberValue(object.left, 0), y: numberValue(object.top, 0) }]))
          };
        }
      }
      const pointer = event.e as { button?: number } | undefined;
      if (pointer?.button === 2) handleContext(event as { target?: FabricObject; e?: { preventDefault: () => void; clientX: number; clientY: number } });
    };
    canvas.on("object:modified", handleModified);
    canvas.on("object:moving", handleMoving);
    const handleCanvasMouseUp = () => { layoutMoveRef.current = null; handleMouseUp(); };
    canvas.on("mouse:up", handleCanvasMouseUp);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:dblclick", (event) => {
      const target = event.target;
      if (target && canvasObject(target).announcementType === "rect") {
        if (canvasObject(target).announcementCellId) addText();
        else addText(numberValue(target.left, 0) + 20, numberValue(target.top, 0) + 20, Math.max(120, target.getScaledWidth() - 40));
      }
    });
    canvas.on("text:changed", handleModified);
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    void loadDocument({ ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    return () => {
      canvas.off("object:modified", handleModified);
      canvas.off("object:moving", handleMoving);
      canvas.off("mouse:up", handleCanvasMouseUp);
      canvas.off("text:changed", handleModified);
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const font of GOOGLE_FONTS) {
      const id = `announcement-font-${font.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = googleFontUrl(font);
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (activePage >= pages.length || !fabricRef.current || (serialized === lastEmittedRef.current && loadedPageRef.current === activePage)) return;
    void loadDocument({ ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
  }, [activePage, currentPage, loadDocument, pages.length, value]);

  function clearGuides() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().filter((object) => canvasObject(object).announcementGuide).forEach((object) => canvas.remove(object));
  }

  function showGuides(target: FabricObject) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    clearGuides();
    const width = currentPage.width;
    const height = currentPage.height;
    const left = numberValue(target.left, 0);
    const top = numberValue(target.top, 0);
    const objectWidth = target.getScaledWidth();
    const objectHeight = target.getScaledHeight();
    const snapX = [24, width / 2 - objectWidth / 2, width / 2, width - 24 - objectWidth, width - 24];
    const snapY = [24, height / 2 - objectHeight / 2, height / 2, height - 24 - objectHeight, height - 24];
    const nearestX = snapX.reduce((best, candidate) => Math.abs(candidate - left) < Math.abs(best - left) ? candidate : best, snapX[0]);
    const nearestY = snapY.reduce((best, candidate) => Math.abs(candidate - top) < Math.abs(best - top) ? candidate : best, snapY[0]);
    const threshold = 12;
    let guideX: number | null = null;
    let guideY: number | null = null;
    if (Math.abs(nearestX - left) <= threshold) {
      target.set({ left: nearestX });
      guideX = nearestX === width / 2 - objectWidth / 2 ? width / 2 : nearestX === width - 24 - objectWidth ? width - 24 : nearestX;
    }
    if (Math.abs(nearestY - top) <= threshold) {
      target.set({ top: nearestY });
      guideY = nearestY === height / 2 - objectHeight / 2 ? height / 2 : nearestY === height - 24 - objectHeight ? height - 24 : nearestY;
    }
    const guideOptions = { stroke: "#e66f51", strokeWidth: 1, strokeDashArray: [6, 5], selectable: false, evented: false };
    if (guideX !== null) {
      const line = new Line([guideX, 0, guideX, height], guideOptions);
      canvasObject(line).announcementGuide = true;
      canvas.add(line);
    }
    if (guideY !== null) {
      const line = new Line([0, guideY, width, guideY], guideOptions);
      canvasObject(line).announcementGuide = true;
      canvas.add(line);
    }
  }

  function layoutObjects(layoutId: string) {
    return fabricRef.current?.getObjects().filter((object) => canvasObject(object).announcementLayoutId === layoutId) ?? [];
  }

  function moveLayout(target: FabricObject) {
    const item = canvasObject(target);
    if (!item.announcementLayoutId || !layoutMoveRef.current) return;
    const deltaX = numberValue(target.left, 0) - layoutMoveRef.current.startX;
    const deltaY = numberValue(target.top, 0) - layoutMoveRef.current.startY;
    for (const object of layoutObjects(item.announcementLayoutId)) {
      if (object === target) continue;
      const position = layoutMoveRef.current.positions.get(canvasObject(object).announcementId ?? "");
      if (!position) continue;
      object.set({ left: position.x + deltaX, top: position.y + deltaY });
      object.setCoords();
    }
  }

  function resizeGridLayout(target: FabricObject) {
    const item = canvasObject(target);
    if (item.announcementLayoutType !== "grid" || !item.announcementLayoutId || !item.announcementCellId) return;
    const cells = layoutObjects(item.announcementLayoutId).filter((object) => canvasObject(object).announcementCellId && canvasObject(object).announcementType === "rect");
    if (!cells.length) return;
    const columns = Math.max(1, item.announcementLayoutColumns ?? Math.round(Math.sqrt(cells.length)));
    const rows = Math.max(1, item.announcementLayoutRows ?? Math.ceil(cells.length / columns));
    const gap = Math.max(0, item.announcementLayoutGap ?? 0);
    const originX = Math.min(...cells.map((object) => numberValue(object.left, 0)));
    const originY = Math.min(...cells.map((object) => numberValue(object.top, 0)));
    const width = Math.min(Math.max(32, target.getScaledWidth()), (currentPage.width - 48 - gap * (columns - 1)) / columns);
    const height = Math.min(Math.max(32, target.getScaledHeight()), (currentPage.height - 48 - gap * (rows - 1)) / rows);
    for (const cell of cells) {
      const cellItem = canvasObject(cell);
      const row = cellItem.announcementCellRow ?? 0;
      const column = cellItem.announcementCellColumn ?? 0;
      cell.set({ left: originX + column * (width + gap), top: originY + row * (height + gap), width, height, scaleX: 1, scaleY: 1 });
      cell.setCoords();
    }
  }

  function updateGridGap(gap: number) {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    const item = active ? canvasObject(active) : undefined;
    if (!canvas || !item?.announcementLayoutId || item.announcementLayoutType !== "grid") return;
    const cells = layoutObjects(item.announcementLayoutId).filter((object) => canvasObject(object).announcementCellId && canvasObject(object).announcementType === "rect");
    if (!cells.length) return;
    const columns = Math.max(1, item.announcementLayoutColumns ?? Math.round(Math.sqrt(cells.length)));
    const originX = Math.min(...cells.map((object) => numberValue(object.left, 0)));
    const originY = Math.min(...cells.map((object) => numberValue(object.top, 0)));
    const width = cells[0].getScaledWidth();
    const height = cells[0].getScaledHeight();
    for (const cell of cells) {
      const cellItem = canvasObject(cell);
      const row = cellItem.announcementCellRow ?? 0;
      const column = cellItem.announcementCellColumn ?? 0;
      cellItem.announcementLayoutGap = gap;
      cell.set({ left: originX + column * (width + gap), top: originY + row * (height + gap) });
      cell.setCoords();
    }
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function publishCanvas(canvas: Canvas) {
    const nextPage = documentFromCanvas(canvas, { ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    publish(withPage(value, activePage, { ...currentPage, width: nextPage.width, height: nextPage.height, background: nextPage.background, elements: nextPage.elements }));
  }

  function layoutCellAtPoint(point: { x: number; y: number }) {
    const canvas = fabricRef.current;
    const cell = canvas?.getObjects().slice().reverse().find((candidate) => {
      const item = canvasObject(candidate);
      if (!item.announcementCellId) return false;
      const left = numberValue(candidate.left, 0);
      const top = numberValue(candidate.top, 0);
      return point.x >= left && point.x <= left + candidate.getScaledWidth() && point.y >= top && point.y <= top + candidate.getScaledHeight();
    });
    if (!cell) return null;
    return { x: numberValue(cell.left, 0), y: numberValue(cell.top, 0), width: cell.getScaledWidth(), height: cell.getScaledHeight() };
  }

  function activeLayoutCell() {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active || !canvasObject(active).announcementCellId) return null;
    return { x: numberValue(active.left, 0), y: numberValue(active.top, 0), width: active.getScaledWidth(), height: active.getScaledHeight() };
  }

  function addTable(preset: typeof TABLE_PRESETS[number]) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const width = Math.min(760, currentPage.width - 48);
    const height = Math.min(560, currentPage.height - 48);
    const position = centeredAnnouncementPosition(currentPage.width, currentPage.height, width, height);
    const cellWidth = width / preset.columns;
    const cellHeight = height / preset.rows;
    const containerId = `table-${Date.now()}`;
    const objects: FabricObject[] = [];
    for (let row = 0; row < preset.rows; row += 1) {
      for (let column = 0; column < preset.columns; column += 1) {
        const isHeader = row < preset.headerRows || column < preset.headerColumns;
        const cell = { id: `table-cell-${containerId}-${row}-${column}`, type: "rect" as const, x: position.x + column * cellWidth, y: position.y + row * cellHeight, width: cellWidth, height: cellHeight, fill: isHeader ? preset.headerFill : (row % 2 === 0 && preset.value === "banded" ? "#f4f6f8" : preset.fill), cornerRadius: 0, stroke: preset.stroke, strokeWidth: 1, container: "table" as const, cellId: `table-cell-${containerId}-${row}-${column}`, layoutId: containerId, layoutType: "table" as const, layoutGap: 0, layoutRows: preset.rows, layoutColumns: preset.columns, cellRow: row, cellColumn: column };
        const object = shapeObject(cell);
        object.setCoords();
        setCanvasObjectMetadata(object, cell);
        const item = canvasObject(object);
        item.announcementContainer = "table";
        item.announcementCellId = cell.id;
        item.announcementLayoutId = containerId;
        item.announcementLayoutType = "table";
        item.announcementLayoutRows = preset.rows;
        item.announcementLayoutColumns = preset.columns;
        item.announcementCellRow = row;
        item.announcementCellColumn = column;
        item.announcementId = cell.id;
        objects.push(object);
        if (isHeader) {
          const label = new Textbox(`${preset.headerColumns && column === 0 ? "Row" : `Column ${column + 1}`}`, { left: cell.x + 10, top: cell.y + 10, originX: "left", originY: "top", width: Math.max(20, cell.width - 20), height: Math.max(20, cell.height - 20), fontSize: 18, fontFamily: "Arial", fill: preset.headerFill === "#17324d" ? "#ffffff" : "#17324d", textAlign: "center", editable: true, transparentCorners: false, cornerColor: "#e66f51" });
          setCanvasObjectMetadata(label, { id: `table-label-${containerId}-${row}-${column}`, type: "text", x: cell.x + 10, y: cell.y + 10, width: Math.max(20, cell.width - 20), height: Math.max(20, cell.height - 20), text: `${preset.headerColumns && column === 0 ? "Row" : `Column ${column + 1}`}`, fontSize: 18, fontFamily: "Arial", fill: preset.headerFill === "#17324d" ? "#ffffff" : "#17324d", align: "center", fontStyle: "bold", container: "table", cellId: cell.id, layoutId: containerId, layoutType: "table", layoutGap: 0, layoutRows: preset.rows, layoutColumns: preset.columns, cellRow: row, cellColumn: column });
          const labelItem = canvasObject(label);
          labelItem.announcementLayoutId = containerId;
          labelItem.announcementLayoutType = "table";
          labelItem.announcementLayoutRows = preset.rows;
          labelItem.announcementLayoutColumns = preset.columns;
          labelItem.announcementCellRow = row;
          labelItem.announcementCellColumn = column;
          objects.push(label);
        }
      }
    }
    canvas.add(...objects);
    canvas.setActiveObject(objects[0]);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addGrid(preset: typeof GRID_PRESETS[number]) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const width = Math.max(48, currentPage.width - 48);
    const height = Math.max(48, currentPage.height - 48);
    const position = centeredAnnouncementPosition(currentPage.width, currentPage.height, width, height);
    const columnWeights: readonly number[] = "columnWeights" in preset ? preset.columnWeights : Array.from({ length: preset.columns }, () => 1);
    const totalColumnWeight = columnWeights.reduce((sum: number, weight: number) => sum + weight, 0);
    const cellWidths = columnWeights.map((weight) => (width - preset.gap * (preset.columns - 1)) * weight / totalColumnWeight);
    const cellHeight = (height - preset.gap * (preset.rows - 1)) / preset.rows;
    const containerId = `grid-${Date.now()}`;
    const objects = Array.from({ length: preset.rows * preset.columns }, (_, index) => {
      const row = Math.floor(index / preset.columns);
      const column = index % preset.columns;
      const cellX = position.x + cellWidths.slice(0, column).reduce((sum: number, cellWidth: number) => sum + cellWidth, 0) + column * preset.gap;
      const isHeader = "headerRows" in preset && row < preset.headerRows;
      const isFooter = "footerRows" in preset && row >= preset.rows - preset.footerRows;
      const cell = { id: `grid-cell-${containerId}-${row}-${column}`, type: "rect" as const, x: cellX, y: position.y + row * (cellHeight + preset.gap), width: cellWidths[column], height: cellHeight, fill: isHeader ? "#17324d" : isFooter ? "#e66f51" : "#ffffff", cornerRadius: 12, stroke: "#c7ced8", strokeWidth: 2, container: "grid" as const, cellId: `grid-cell-${containerId}-${row}-${column}`, layoutId: containerId, layoutType: "grid" as const, layoutGap: preset.gap, layoutRows: preset.rows, layoutColumns: preset.columns, cellRow: row, cellColumn: column };
      const object = shapeObject(cell);
      object.setCoords();
      setCanvasObjectMetadata(object, cell);
      const item = canvasObject(object);
      item.announcementContainer = "grid";
      item.announcementCellId = cell.id;
      item.announcementLayoutId = containerId;
      item.announcementLayoutType = "grid";
      item.announcementLayoutRows = preset.rows;
      item.announcementLayoutColumns = preset.columns;
      item.announcementLayoutGap = preset.gap;
      item.announcementCellRow = row;
      item.announcementCellColumn = column;
      item.announcementId = cell.id;
      return object;
    });
    canvas.add(...objects);
    canvas.setActiveObject(objects[0]);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addText(left?: number, top?: number, width = Math.min(700, currentPage.width - 140), preset: "textbox" | "heading" | "subheading" | "body" = "textbox") {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const centeredWidth = Math.max(120, Math.min(width, currentPage.width - 48));
    const styles = { textbox: { text: "Double-click to edit", fontSize: 34, height: 90 }, heading: { text: "Heading", fontSize: 52, height: 110 }, subheading: { text: "Subheading", fontSize: 36, height: 90 }, body: { text: "Body text", fontSize: 24, height: 180 } }[preset];
    const cell = left === undefined && top === undefined ? activeLayoutCell() : null;
    const cellWidth = cell ? Math.max(48, cell.width - 16) : centeredWidth;
    const cellHeight = cell ? Math.max(48, cell.height - 16) : styles.height;
    const presetPosition = cell ? centeredAnnouncementPosition(cell.width, cell.height, cellWidth, Math.min(styles.height, cellHeight), 8) : centeredAnnouncementPosition(currentPage.width, currentPage.height, centeredWidth, styles.height);
    const activeObject = canvas.getActiveObject();
    const activeCellObject = activeObject ? canvasObject(activeObject) : undefined;
    const element: Extract<AnnouncementElement, { type: "text" }> = { id: `text-${Date.now()}`, type: "text", x: left ?? (cell ? cell.x + presetPosition.x : presetPosition.x), y: top ?? (cell ? cell.y + presetPosition.y : presetPosition.y), width: cellWidth, height: cell ? Math.min(styles.height, cellHeight) : styles.height, text: styles.text, fontSize: styles.fontSize, fontFamily: "Arial", fill: "#17324d", align: "center", fontStyle: "normal", underline: false, container: activeCellObject?.announcementContainer, cellId: activeCellObject?.announcementCellId, layoutId: activeCellObject?.announcementLayoutId, layoutType: activeCellObject?.announcementLayoutType, layoutGap: activeCellObject?.announcementLayoutGap };
    const object = new Textbox(element.text, { left: element.x, top: element.y, originX: "left", originY: "top", width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, textAlign: element.align, editable: true, transparentCorners: false, cornerColor: "#e66f51" });
    object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addShape(shape: AnnouncementShape = "rect", dropPoint?: { x: number; y: number }, cornerRadius = 14) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const width = Math.min(260, currentPage.width - 48);
    const height = Math.min(120, currentPage.height - 48);
    const centered = centeredAnnouncementPosition(currentPage.width, currentPage.height, width, height);
    const position = dropPoint ? { x: Math.max(0, Math.min(currentPage.width - width, dropPoint.x - width / 2)), y: Math.max(0, Math.min(currentPage.height - height, dropPoint.y - height / 2)) } : centered;
    const element: Extract<AnnouncementElement, { type: "rect" }> = { id: `shape-${Date.now()}`, type: "rect", shape, x: position.x, y: position.y, width, height, fill: "#e66f51", cornerRadius };
    const object = shapeObject(element);
    positionShapeObject(object, element);
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addImage(url: string, alt = "", dropPoint?: { x: number; y: number }) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    void FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((object) => {
      const cell = dropPoint ? layoutCellAtPoint(dropPoint) : activeLayoutCell();
      const width = cell ? Math.max(32, Math.min(cell.width - 16, 700)) : Math.min(700, currentPage.width - 48);
      const height = cell ? Math.max(32, Math.min(cell.height - 16, 300)) : Math.min(300, currentPage.height - 48);
      const centered = cell ? centeredAnnouncementPosition(cell.width, cell.height, width, height, 8) : centeredAnnouncementPosition(currentPage.width, currentPage.height, width, height);
      const position = dropPoint && !cell ? { x: Math.max(0, Math.min(currentPage.width - width, dropPoint.x - width / 2)), y: Math.max(0, Math.min(currentPage.height - height, dropPoint.y - height / 2)) } : { x: (cell?.x ?? 0) + centered.x, y: (cell?.y ?? 0) + centered.y };
      const activeCellObject = cell ? canvas.getObjects().map((candidate) => canvasObject(candidate)).find((candidate) => candidate.announcementCellId && numberValue(candidate.left, 0) === cell.x && numberValue(candidate.top, 0) === cell.y) : undefined;
      const element: Extract<AnnouncementElement, { type: "image" }> = { id: `image-${Date.now()}`, type: "image", x: position.x, y: position.y, width, height, src: url, alt, cornerRadius: 14, container: activeCellObject?.announcementContainer, cellId: activeCellObject?.announcementCellId, layoutId: activeCellObject?.announcementLayoutId, layoutType: activeCellObject?.announcementLayoutType, layoutGap: activeCellObject?.announcementLayoutGap };
      object.set({ left: element.x, top: element.y, originX: "left", originY: "top", scaleX: element.width / Math.max(1, object.width ?? element.width), scaleY: element.height / Math.max(1, object.height ?? element.height), transparentCorners: false, cornerColor: "#e66f51" });
      setCanvasObjectMetadata(object, element);
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      publishCanvas(canvas);
      refreshSelection();
    });
  }

  function canvasDropPoint(event: DragEvent<HTMLDivElement>) {
    const bounds = canvasViewportRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return announcementCanvasDropPoint(event.clientX, event.clientY, bounds, zoom);
  }

  function handleCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = canvasDropPoint(event);
    const payload = event.dataTransfer.getData("application/x-announcement-insert");
    if (!payload) return;
    try {
      const item = JSON.parse(payload) as { type: "image" | "shape" | "grid"; url?: string; alt?: string; shape?: AnnouncementShape; cornerRadius?: number; grid?: typeof GRID_PRESETS[number]["value"] };
      if (item.type === "image" && item.url) addImage(item.url, item.alt ?? "", point);
      if (item.type === "shape" && item.shape) addShape(item.shape, point, item.cornerRadius);
      if (item.type === "grid" && item.grid) {
        const preset = GRID_PRESETS.find((candidate) => candidate.value === item.grid);
        if (preset) addGrid(preset);
      }
    } catch {
      setMediaError("Unable to add the dropped item.");
    }
  }

  function updateSelected(patch: Record<string, unknown>) {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const item = canvasObject(object);
    const nextPatch = { ...patch };
    if (item.announcementType === "rect" && object.originX === "center" && object.originY === "center") {
      if ("left" in nextPatch) nextPatch.left = Number(nextPatch.left) + object.getScaledWidth() / 2;
      if ("top" in nextPatch) nextPatch.top = Number(nextPatch.top) + object.getScaledHeight() / 2;
    }
    if ("announcementLink" in patch) item.announcementLink = String(patch.announcementLink ?? "");
    if ("announcementShape" in patch) item.announcementShape = patch.announcementShape as CanvasObject["announcementShape"];
    if ("shadowOptions" in patch) {
      const options = patch.shadowOptions as { color: string; blur: number; offsetX: number; offsetY: number } | null;
      object.set({ shadow: options ? new Shadow(options) : undefined });
    }
    object.set(nextPatch);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addPage() {
    const nextPage: AnnouncementPage = { id: `page-${Date.now()}`, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: [] };
    const next = { ...value, pages: [...pages, nextPage] };
    setActivePage(pages.length);
    lastDocumentRef.current = JSON.stringify(next);
    lastEmittedRef.current = JSON.stringify(next);
    onChange(next);
  }

  function changePageSize(width: number, height: number) {
    const nextPage = { ...currentPage, width, height };
    const next = withPage(value, activePage, nextPage);
    publish(next);
    void loadDocument({ ...nextPage, version: 1, elements: nextPage.elements });
  }

  function applyCustomPageSize() {
    const factor = customUnit === "in" ? 96 : customUnit === "mm" ? 96 / 25.4 : customUnit === "cm" ? 96 / 2.54 : 1;
    const width = Math.round(Number(customWidth) * factor);
    const height = Math.round(Number(customHeight) * factor);
    if (width >= 320 && height >= 320 && width <= 2000 && height <= 3000) changePageSize(width, height);
  }

  function downloadFile(name: string, contents: string, type: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([contents], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadBlob(name: string, blob: Blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportPageImages() {
    const canvas = fabricRef.current;
    if (!canvas) return [];
    const images: { page: AnnouncementPage; dataUrl: string }[] = [];
    for (const page of pages) {
      await loadDocument({ ...value, pages: undefined, width: page.width, height: page.height, background: page.background, elements: page.elements });
      images.push({ page, dataUrl: canvas.toDataURL({ format: "png", multiplier: 1 }) });
    }
    await loadDocument({ ...value, pages: undefined, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    return images;
  }

  function exportPng() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    downloadFile(`announcement-page-${activePage + 1}.png`, canvas.toDataURL({ format: "png", multiplier: 1 }), "image/png");
  }

  function exportSvg() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    downloadFile(`announcement-page-${activePage + 1}.svg`, canvas.toSVG(), "image/svg+xml");
  }

  async function exportZip() {
    const images = await exportPageImages();
    if (!images.length) return;
    const zip = new JSZip();
    images.forEach((image, index) => zip.file(`announcement-page-${index + 1}.png`, image.dataUrl.split(",")[1], { base64: true }));
    downloadBlob("announcement-pages.zip", await zip.generateAsync({ type: "blob" }));
  }

  async function exportPdf() {
    const images = await exportPageImages();
    if (!images.length) return;
    const first = images[0].page;
    const pdf = new jsPDF({ unit: "px", format: [first.width, first.height], orientation: first.width >= first.height ? "landscape" : "portrait" });
    images.forEach((image, index) => {
      if (index > 0) pdf.addPage([image.page.width, image.page.height], image.page.width >= image.page.height ? "landscape" : "portrait");
      pdf.addImage(image.dataUrl, "PNG", 0, 0, image.page.width, image.page.height);
    });
    pdf.save("announcement.pdf");
  }

  function exportHtml() {
    const html = pages.map((page) => announcementDocumentToHtml({ ...value, width: page.width, height: page.height, background: page.background, elements: page.elements })).join("\n");
    downloadFile("announcement.html", `<!doctype html><html><head><meta charset="utf-8"><title>Announcement</title></head><body>${html}</body></html>`, "text/html");
  }

  function printPdf() {
    const html = pages.map((page) => announcementDocumentToHtml({ ...value, width: page.width, height: page.height, background: page.background, elements: page.elements })).join('<div style="page-break-after:always"></div>');
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Announcement</title></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.remove(object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function deleteLayout() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    const layoutId = object ? canvasObject(object).announcementLayoutId : undefined;
    if (!canvas || !layoutId) return;
    for (const layoutObject of layoutObjects(layoutId)) canvas.remove(layoutObject);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function duplicateSelected() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    void object.clone().then((copy) => {
      const source = canvasObject(object);
      const duplicate = canvasObject(copy);
      duplicate.announcementId = `${source.announcementId ?? "element"}-${Date.now()}`;
      duplicate.announcementType = source.announcementType;
      duplicate.announcementAlt = source.announcementAlt;
      duplicate.announcementCornerRadius = source.announcementCornerRadius;
      duplicate.announcementStroke = source.announcementStroke;
      duplicate.announcementStrokeWidth = source.announcementStrokeWidth;
      (duplicate as CanvasObject & { announcementSrc?: string }).announcementSrc = (source as CanvasObject & { announcementSrc?: string }).announcementSrc;
      duplicate.set({ left: numberValue(object.left, 0) + 24, top: numberValue(object.top, 0) + 24 });
      canvas.add(copy);
      canvas.setActiveObject(copy);
      canvas.requestRenderAll();
      publishCanvas(canvas);
      refreshSelection();
    });
  }

  function moveLayer(direction: "up" | "down") {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const index = canvas.getObjects().indexOf(object);
    const nextIndex = direction === "up" ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= canvas.getObjects().length) return;
    canvas.moveObjectTo(object, nextIndex);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [JSON.parse(lastDocumentRef.current) as AnnouncementDocument, ...items]);
    void loadDocument(previous);
    onChange(previous);
    lastDocumentRef.current = JSON.stringify(previous);
    lastEmittedRef.current = JSON.stringify(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, JSON.parse(lastDocumentRef.current) as AnnouncementDocument]);
    void loadDocument(next);
    onChange(next);
    lastDocumentRef.current = JSON.stringify(next);
    lastEmittedRef.current = JSON.stringify(next);
  }

  const canvasWidth = currentPage.width * zoom;
  const selectedText = selected?.type === "text";
  const usedFonts = Array.from(new Set(currentPage.elements.filter((element): element is Extract<AnnouncementElement, { type: "text" }> => element.type === "text").map((element) => element.fontFamily)));
  const filterFonts = (fonts: string[]) => fonts.filter((font) => !fontQuery || font.toLowerCase().includes(fontQuery.toLowerCase()));
  const groupedFonts = new Set([...usedFonts, ...COMMONLY_USED_FONTS, ...COMMON_FONTS]);
  const alignIcon = (align: "left" | "center" | "right") => {
    const widths = align === "left" ? ["100%", "72%", "88%"] : align === "center" ? ["72%", "100%", "72%"] : ["88%", "72%", "100%"];
    return <span aria-hidden="true" className={`inline-flex w-5 flex-col gap-0.5 ${align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start"}`}>{widths.map((width, index) => <span key={index} className="block h-0.5 rounded bg-current" style={{ width }} />)}</span>;
  };
  return <div className="relative grid gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-[#f3f4f6]" onContextMenu={(event) => event.preventDefault()}>
    <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-white px-3 py-2">
      <span className="mr-2 font-semibold text-ink">Design</span>
      <Button type="button" variant="secondary" onClick={() => addText()}>Text</Button>
      <select aria-label="Add shape" className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" value="" onChange={(event) => { if (event.target.value) addShape(event.target.value as AnnouncementShape); }}>
        <option value="">Add shape</option>{ANNOUNCEMENT_SHAPES.filter((shape, index, all) => all.findIndex((candidate) => candidate.value === shape.value) === index).map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
      </select>
      <MediaPicker label="Images" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} />
      <Button type="button" variant="secondary" onClick={addPage}>Add page</Button>
      <select aria-label="Current page" className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm" value={activePage} onChange={(event) => setActivePage(Number(event.target.value))}>{pages.map((page, index) => <option key={page.id} value={index}>Page {index + 1}</option>)}</select>
      <select aria-label="Page size" className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm" value="" onChange={(event) => { const preset = PAGE_PRESETS.find((item) => item.label === event.target.value); if (preset) { setCustomWidth(String(preset.width)); setCustomHeight(String(preset.height)); setCustomUnit("px"); changePageSize(preset.width, preset.height); } }}>
        <option value="">Page size</option>{PAGE_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
      </select>
      <div className="flex items-center gap-1 rounded-lg border border-ink/15 bg-white p-1"><input aria-label="Custom page width" type="number" min="1" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} className="w-16 px-1 text-xs" /><span className="text-xs text-ink/40">×</span><input aria-label="Custom page height" type="number" min="1" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} className="w-16 px-1 text-xs" /><select aria-label="Custom page size unit" value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} className="text-xs"><option value="px">px</option><option value="in">in</option><option value="mm">mm</option><option value="cm">cm</option></select><button type="button" className="focus-ring rounded bg-coral px-2 py-1 text-xs font-semibold text-white" onClick={applyCustomPageSize}>Apply</button></div>
      <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink/60">Zoom {Math.round(zoom * 100)}% <input aria-label="Canvas zoom" type="range" min="0.35" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></span>
      <Button type="button" variant="secondary" disabled={!history.length} onClick={undo}>Undo</Button>
      <Button type="button" variant="secondary" disabled={!future.length} onClick={redo}>Redo</Button>
      <div className="flex gap-1"><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportPng}>PNG</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportSvg}>SVG</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportZip}>ZIP</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportHtml}>HTML</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportPdf}>PDF</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={printPdf}>Print</button></div>
    </div>
    <div className="grid min-w-0 lg:grid-cols-[64px_200px_minmax(0,1fr)_260px]">
      <aside className="hidden border-r border-ink/10 bg-white p-2 lg:block">
        <p className="sr-only">Insert category</p>
        {([['text', 'T', 'Text'], ['images', '▧', 'Images'], ['shapes', '◆', 'Shapes'], ['tables', '▤', 'Tables'], ['grids', '▦', 'Grid']] as const).map(([category, icon, label]) => <button key={category} type="button" aria-label={label} title={label} onClick={() => setInsertCategory(category)} className={"focus-ring mb-2 flex w-full flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold " + (insertCategory === category ? "border-coral bg-coral/10 text-coral" : "border-transparent text-ink/60 hover:border-ink/15")}>{icon}<span>{label}</span></button>)}
      </aside>
      <aside className="hidden border-r border-ink/10 bg-white p-3 lg:block">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Add to page</p>
        {insertCategory === "text" && <div className="mt-3 grid gap-2">
          <button type="button" onClick={() => addText()} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-lg font-bold">T</span><span className="text-xs font-semibold">Add a Textbox</span></button>
          <button type="button" onClick={() => addText(undefined, undefined, Math.min(760, currentPage.width - 48), "heading")} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-xl font-bold">Heading</span><span className="text-xs text-ink/55">Large centered heading</span></button>
          <button type="button" onClick={() => addText(undefined, undefined, Math.min(700, currentPage.width - 48), "subheading")} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-lg font-semibold">Subheading</span><span className="text-xs text-ink/55">Supporting text</span></button>
          <button type="button" onClick={() => addText(undefined, undefined, Math.min(650, currentPage.width - 48), "body")} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-sm">Body</span><span className="text-xs text-ink/55">Readable paragraph text</span></button>
        </div>}
        {insertCategory === "shapes" && <div className="mt-3 grid max-h-[min(62vh,680px)] grid-cols-2 gap-2 overflow-y-auto pr-1">{ANNOUNCEMENT_SHAPES.map((shape) => { const cornerRadius = shape.value === "rect" && shape.label === "Rounded" ? 14 : 0; const points = announcementShapePoints(shape.value); return <button key={`${shape.value}-${shape.label}`} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-announcement-insert", JSON.stringify({ type: "shape", shape: shape.value, cornerRadius })); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addShape(shape.value, undefined, cornerRadius)} className="focus-ring grid min-h-20 place-items-center rounded-xl border border-ink/10 p-2 text-xs hover:border-coral"><span className="grid h-10 w-12 place-items-center text-2xl text-coral" style={{ clipPath: points.length ? `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(",")})` : undefined, backgroundColor: "currentColor", borderRadius: shape.value === "circle" ? "999px" : cornerRadius ? "8px" : undefined }}>{points.length ? "" : shape.icon}</span><span>{shape.label}</span></button>; })}</div>}
        {insertCategory === "tables" && <div className="mt-3 grid gap-2">{TABLE_PRESETS.map((preset) => <button key={preset.value} type="button" onClick={() => addTable(preset)} className="focus-ring rounded-xl border border-ink/10 p-2 text-left hover:border-coral"><span className="grid overflow-hidden rounded border" style={{ gridTemplateColumns: `repeat(${preset.columns}, minmax(0, 1fr))` }}>{Array.from({ length: preset.rows * preset.columns }, (_, index) => { const row = Math.floor(index / preset.columns); const column = index % preset.columns; const header = row < preset.headerRows || column < preset.headerColumns; return <span key={index} className="h-5 border-b border-r" style={{ backgroundColor: header ? preset.headerFill : row % 2 === 0 && preset.value === "banded" ? "#f4f6f8" : preset.fill }} />; })}</span><span className="mt-2 block text-xs font-semibold">{preset.label}</span></button>)}</div>}
        {insertCategory === "grids" && <div className="mt-3 grid gap-2">{GRID_PRESETS.map((preset) => <button key={preset.value} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-announcement-insert", JSON.stringify({ type: "grid", grid: preset.value })); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addGrid(preset)} className="focus-ring rounded-xl border border-ink/10 p-2 text-left hover:border-coral"><span className="grid rounded border border-ink/20 bg-mist/30 p-1" style={{ gridTemplateColumns: `repeat(${preset.columns}, minmax(0, 1fr))`, gap: 3 }}>{Array.from({ length: preset.rows * preset.columns }, (_, index) => <span key={index} className="h-7 rounded border border-dashed border-ink/25 bg-white" />)}</span><span className="mt-2 block text-xs font-semibold">{preset.label}</span></button>)}</div>}
        {insertCategory === "images" && <div className="mt-3 grid gap-2">{mediaLoading && <p className="text-xs text-ink/55">Loading images...</p>}{mediaError && <p role="alert" className="text-xs text-coral">{mediaError}</p>}{!mediaLoading && !mediaAssets.length && <><p className="text-xs text-ink/55">No images found.</p><MediaPicker label="Open media library" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} /></>}{mediaAssets.map((asset) => <button key={asset.id} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-announcement-insert", JSON.stringify({ type: "image", url: asset.url, alt: asset.altText ?? asset.title ?? asset.originalName })); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} className="focus-ring overflow-hidden rounded-xl border border-ink/10 text-left hover:border-coral"><img src={asset.url} alt={asset.altText ?? asset.title ?? asset.originalName} className="aspect-video w-full object-cover" /><span className="block truncate p-2 text-xs font-semibold">{asset.title || asset.originalName}</span></button>)}</div>}
        <label className="mt-5 grid gap-2 text-xs font-semibold text-ink/60">Page background<input type="color" value={currentPage.background} onChange={(event) => { const canvas = fabricRef.current; if (!canvas) return; canvas.backgroundColor = event.target.value; canvas.requestRenderAll(); publish(withPage(value, activePage, { ...currentPage, background: event.target.value })); }} className="h-10 w-full rounded border border-ink/10 bg-white p-1" /></label>
      </aside>
      <div className="min-w-0 overflow-auto p-5 sm:p-8" onDragOver={(event) => event.preventDefault()} onDrop={handleCanvasDrop}><div className="mx-auto overflow-hidden shadow-2xl" style={{ width: canvasWidth, height: currentPage.height * zoom }}><div ref={canvasViewportRef} style={{ width: currentPage.width, height: currentPage.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}><canvas ref={canvasElementRef} /></div></div><p className="mt-4 text-center text-xs text-ink/50">Drag objects toward the dashed guides to align them. Hold Shift while dragging to bypass snapping. Double-click text or shapes to edit.</p></div>
      <aside className="border-t border-ink/10 bg-white p-3 lg:border-l lg:border-t-0"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Properties</p>{selected ? <div className="mt-3 grid gap-3 text-xs"><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 font-semibold text-ink/60">X<input type="number" value={Math.round(selected.x)} onChange={(event) => updateSelected({ left: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><label className="grid gap-1 font-semibold text-ink/60">Y<input type="number" value={Math.round(selected.y)} onChange={(event) => updateSelected({ top: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label></div>{selected.layoutId && <div className="grid gap-2 rounded-lg border border-coral/30 bg-coral/5 p-2"><p className="font-semibold text-coral">{selected.layoutType === "grid" ? "Grid layout" : "Table layout"}</p>{selected.layoutType === "grid" && <label className="grid gap-1 font-semibold text-ink/60">Cell gap<input type="range" min="0" max="80" value={selected.layoutGap ?? 0} onChange={(event) => updateGridGap(Number(event.target.value))} /></label>}<Button type="button" variant="secondary" className="border-coral text-coral" onClick={deleteLayout}>Delete entire {selected.layoutType === "grid" ? "grid" : "table"}</Button></div>}{selectedText && <><label className="grid gap-1 font-semibold text-ink/60">Font search<input value={fontQuery} onChange={(event) => setFontQuery(event.target.value)} placeholder="Search fonts" className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><label className="grid gap-1 font-semibold text-ink/60">Font<select value={selected.fontFamily ?? "Arial"} onChange={(event) => updateSelected({ fontFamily: event.target.value })} className="focus-ring rounded border border-ink/15 px-2 py-1"><optgroup label="Fonts used in canvas">{filterFonts(usedFonts).map((font) => <option key={`used-${font}`}>{font}</option>)}</optgroup><optgroup label="Commonly used fonts">{filterFonts(COMMONLY_USED_FONTS).map((font) => <option key={`common-used-${font}`}>{font}</option>)}</optgroup><optgroup label="Common fonts">{filterFonts(COMMON_FONTS).map((font) => <option key={`common-${font}`}>{font}</option>)}</optgroup><optgroup label="Alphabetical">{filterFonts(GOOGLE_FONTS.filter((font) => !groupedFonts.has(font))).sort((a, b) => a.localeCompare(b)).map((font) => <option key={`alphabetical-${font}`}>{font}</option>)}</optgroup></select></label><label className="grid gap-1 font-semibold text-ink/60">Size (px)<select value={Math.round(selected.fontSize ?? 24)} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1">{FONT_SIZES.map((size) => <option key={size} value={size}>{size}px</option>)}</select></label><div className="flex gap-2"><button type="button" aria-label="Bold" className="focus-ring rounded border border-ink/15 px-2 py-1 font-bold" onClick={() => updateSelected({ fontWeight: selected.fontStyle === "bold" ? "normal" : "bold" })}>B</button><button type="button" aria-label="Italic" className="focus-ring rounded border border-ink/15 px-2 py-1 italic" onClick={() => updateSelected({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}>I</button><button type="button" aria-label="Underline" className={`focus-ring rounded border px-2 py-1 underline ${selected.underline ? "border-coral bg-coral/10 text-coral" : "border-ink/15"}`} onClick={() => updateSelected({ underline: !selected.underline })}>U</button>{(["left", "center", "right"] as const).map((align) => <button key={align} type="button" aria-label={`${align} align`} title={`${align} align`} className={`focus-ring rounded border px-2 py-1 text-lg leading-none ${selected.align === align ? "border-coral text-coral" : "border-ink/15"}`} onClick={() => updateSelected({ textAlign: align })}>{alignIcon(align)}</button>)}</div><label className="grid gap-1 font-semibold text-ink/60">Link (optional)<input type="url" value={selected.link ?? ""} onChange={(event) => updateSelected({ announcementLink: event.target.value })} placeholder="https://..." className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><div className="grid gap-2"><div className="grid grid-cols-2 gap-2"><Button type="button" className={selected.shadow && selected.shadow.color !== "#ffffffcc" ? "border-coral bg-coral/10 text-coral" : ""} variant="secondary" onClick={() => updateSelected({ shadowOptions: selected.shadow && selected.shadow.color !== "#ffffffcc" ? null : { color: "#00000066", blur: 8, offsetX: 2, offsetY: 2 } })}>Text shadow</Button><Button type="button" className={selected.shadow?.color === "#ffffffcc" ? "border-coral bg-coral/10 text-coral" : ""} variant="secondary" onClick={() => updateSelected({ shadowOptions: selected.shadow?.color === "#ffffffcc" ? null : { color: "#ffffffcc", blur: 0, offsetX: 0, offsetY: 2 } })}>Text lift</Button></div>{selected.shadow && <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 font-semibold text-ink/60">Color<input type="color" value={selected.shadow.color.slice(0, 7)} onChange={(event) => updateSelected({ shadowOptions: { ...selected.shadow, color: event.target.value } })} /></label><label className="grid gap-1 font-semibold text-ink/60">Blur<input type="range" min="0" max="40" value={selected.shadow.blur} onChange={(event) => updateSelected({ shadowOptions: { ...selected.shadow, blur: Number(event.target.value) } })} /></label><label className="grid gap-1 font-semibold text-ink/60">Horizontal distance<input type="range" min="-40" max="40" value={selected.shadow.offsetX} onChange={(event) => updateSelected({ shadowOptions: { ...selected.shadow, offsetX: Number(event.target.value) } })} /></label><label className="grid gap-1 font-semibold text-ink/60">Vertical distance<input type="range" min="-40" max="40" value={selected.shadow.offsetY} onChange={(event) => updateSelected({ shadowOptions: { ...selected.shadow, offsetY: Number(event.target.value) } })} /></label></div>}</div></>}{selected.type === "rect" && <label className="grid gap-1 font-semibold text-ink/60">Shape<select value={selected.shape ?? "rect"} onChange={(event) => updateSelected({ announcementShape: event.target.value })} className="focus-ring rounded border border-ink/15 px-2 py-1"><option value="rect">Rectangle</option>{ANNOUNCEMENT_SHAPES.filter((shape, index, all) => shape.value !== "rect" || index === 0).map((shape) => <option key={`${shape.value}-${shape.label}`} value={shape.value}>{shape.label}</option>)}</select></label>}{selected.type !== "image" && <label className="grid gap-1 font-semibold text-ink/60">Color<input type="color" value={selected.fill?.startsWith("#") ? selected.fill : "#17324d"} onChange={(event) => updateSelected({ fill: event.target.value })} className="h-9 w-full rounded border border-ink/10 p-1" /></label>}<label className="grid gap-1 font-semibold text-ink/60">Opacity<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateSelected({ opacity: Number(event.target.value) })} /></label><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={duplicateSelected}>Duplicate</Button><Button type="button" variant="secondary" onClick={deleteSelected}>Delete</Button></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={() => moveLayer("up")}>Bring forward</Button><Button type="button" variant="secondary" onClick={() => moveLayer("down")}>Send backward</Button></div></div> : <p className="mt-3 text-xs leading-5 text-ink/50">Select an object to edit its properties, or right-click for item actions.</p>}<div className="mt-6 border-t border-ink/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Layers</p><div className="mt-2 grid gap-1">{layers.map((layer) => <button type="button" key={layer.id} className={`focus-ring truncate rounded px-2 py-1 text-left text-xs ${selected?.id === layer.id ? "bg-coral/10 font-semibold text-coral" : "hover:bg-mist"}`} onClick={() => { const canvas = fabricRef.current; const object = canvas?.getObjects().find((candidate) => canvasObject(candidate).announcementId === layer.id); if (canvas && object) { canvas.setActiveObject(object); canvas.requestRenderAll(); refreshSelection(); } }}>{layer.type === "text" ? (layer.text || "Text").slice(0, 24) : layer.type === "image" ? "Image" : `${layer.shape ?? "Shape"}`}</button>)}</div></div></aside>
    </div>
    {contextMenu && <div className="fixed z-50 grid min-w-40 gap-1 rounded-lg border border-ink/15 bg-white p-1 text-sm shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)}><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { duplicateSelected(); setContextMenu(null); }}>Duplicate</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { moveLayer("up"); setContextMenu(null); }}>Bring forward</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { moveLayer("down"); setContextMenu(null); }}>Send backward</button>{selected?.layoutId && <button type="button" className="rounded px-3 py-2 text-left font-semibold text-coral hover:bg-mist" onClick={() => { deleteLayout(); setContextMenu(null); }}>Delete entire {selected.layoutType === "grid" ? "grid" : "table"}</button>}<button type="button" className="rounded px-3 py-2 text-left text-coral hover:bg-mist" onClick={() => { deleteSelected(); setContextMenu(null); }}>Delete</button></div>}
  </div>;
}

export function emptyAnnouncementDocument(title = "") {
  return defaultAnnouncementDocument(title);
}
