# Rychlé Rýče - Zahradní služby

Webová aplikace pro spojování zákazníků se zahradními brigádníky.

## Funkce

- **Zákazníci**: Objednávání zahradních služeb s mapou, fotkami a detailním popisem
- **Brigádníci**: Přijímání a správa zakázek
- **Admin**: Správa objednávek a brigádníků

## Typy služeb

1. **Sekání trávy** (~20 Kč/m²)
2. **Stříhání stromů/keřů** (~500 Kč/strom)
3. **Natírání plotu** (~15 Kč/m)
4. **Jiná práce** (~200 Kč/hod)

## Technologie

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: Bootstrap 5, Vanilla JavaScript
- **Maps**: OpenStreetMap/Leaflet
- **Upload**: Multer pro fotky

## Nasazení na Render

### Rychlé nasazení

1. **Fork/Clone repository**
```bash
git clone https://github.com/your-username/rychle-ryce.git
cd rychle-ryce
```

2. **Připojení k Render**
   - Přihlaste se na [render.com](https://render.com)
   - Klikněte "New +" → "Web Service"
   - Připojte GitHub repository
   - Render automaticky detekuje `render.yaml`

3. **Automatické nasazení**
   - Render použije nastavení z `render.yaml`
   - Spustí `npm install` a `npm start`
   - Aplikace bude dostupná na `https://your-app-name.onrender.com`

### Manuální nasazení

Pokud nechcete použít `render.yaml`:

1. Na Render vytvořte "Web Service"
2. Nastavte:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free

### Environment Variables

Render automaticky vygeneruje:
- `SESSION_SECRET` - pro zabezpečení sessions
- `NODE_ENV=production`

## Lokální vývoj

```bash
# Instalace dependencies
npm install

# Spuštění v development módu
npm run dev

# Spuštění v production módu
npm start
```

Aplikace bude dostupná na `http://localhost:3000`

## Struktura projektu

```
rychle-ryce/
├── server.js           # Hlavní server soubor
├── package.json        # Dependencies
├── render.yaml         # Render konfigurace
├── public/             # Statické soubory
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── customer_dashboard.html
│   ├── worker_dashboard.html
│   ├── admin_panel.html
│   ├── order_form.html
│   ├── app.js
│   ├── style.css
│   └── uploads/        # Nahrané fotky
└── data/               # SQLite databáze
    ├── database.db
    └── sessions.db
```

## Demo účty

Po prvním spuštění se automaticky vytvoří admin účet:
- **Email**: admin@rychleryce.cz
- **Heslo**: admin123

## API Endpoints

### Autentifikace
- `POST /api/register` - Registrace uživatele
- `POST /api/login` - Přihlášení
- `POST /api/logout` - Odhlášení
- `GET /api/check-auth` - Kontrola přihlášení

### Objednávky
- `POST /api/orders` - Vytvoření objednávky
- `GET /api/my-orders` - Moje objednávky
- `GET /api/available-orders` - Dostupné zakázky (brigádníci)
- `POST /api/orders/:id/accept` - Přijetí zakázky
- `POST /api/orders/:id/complete` - Dokončení zakázky
- `POST /api/orders/:id/rate` - Hodnocení zakázky

### Admin
- `GET /api/admin/orders` - Všechny objednávky
- `GET /api/admin/workers` - Všichni brigádníci

## Databáze

Aplikace používá SQLite databázi s těmito tabulkami:

### users
- Uživatelé (zákazníci, brigádníci, admin)
- Role: 'customer', 'worker', 'admin'

### orders
- Objednávky zahradních služeb
- Status: 'pending', 'accepted', 'completed', 'cancelled'

## Funkce

### Pro zákazníky
- Objednávání služeb s mapou
- Upload až 3 fotek
- Sledování stavu objednávek
- Hodnocení brigádníků

### Pro brigádníky
- Prohlížení dostupných zakázek
- Přijímání a dokončování práce
- Statistiky výdělků

### Pro adminy
- Přehled všech objednávek
- Správa brigádníků
- Celkové statistiky

## Render specifika

- **Free tier**: Aplikace se po 15 minutách nečinnosti uspí
- **Database**: SQLite soubory se ukládají do ephemeral storage
- **Uploads**: Fotky se ukládají lokálně (pro production doporučuji cloudové úložiště)
- **HTTPS**: Automaticky poskytuje Render

## Production doporučení

Pro produkční nasazení zvažte:
1. **PostgreSQL** místo SQLite
2. **Cloudové úložiště** pro fotky (AWS S3, Cloudinary)
3. **Redis** pro sessions
4. **Environment variables** pro citlivé údaje
5. **Rate limiting** pro API
6. **Input validation** a sanitization
7. **Error monitoring** (Sentry)

## Podpora

Pro otázky a problémy vytvořte issue v GitHub repository.