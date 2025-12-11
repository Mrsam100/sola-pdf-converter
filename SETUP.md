# Sola PDF Converter - Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key ⚠️ REQUIRED
1. Get your Gemini API key from: https://aistudio.google.com/apikey
2. Create a `.env` file in the project root:
```bash
cp .env.example .env
```
3. Open `.env` and add your API key:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```

The app will be available at: `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
npm run preview
```

## 🔒 Security Best Practices

### ✅ FIXED VULNERABILITIES:

1. **API Key Security**
   - `.env` file is now properly ignored in `.gitignore`
   - Never commit your `.env` file to version control
   - API keys are loaded securely through Vite's environment variable system

2. **Google Generative AI API**
   - Fixed incorrect API implementation
   - Proper error handling for API failures
   - Rate limiting handled by Google's API

3. **Configuration Files**
   - Fixed ESM import issues in `vite.config.ts`
   - Proper `__dirname` implementation for ES modules
   - All imports use Node.js protocol prefixes (`node:`)

4. **Frontend Security**
   - CSS properly imported to prevent blank page
   - No sensitive data exposed in client-side code
   - File uploads handled securely

### ⚠️ IMPORTANT SECURITY NOTES:

1. **Never share your API key publicly**
2. **Rotate your API key if exposed**
3. **Use environment-specific `.env` files**
4. **Enable CORS only for trusted domains in production**
5. **Implement rate limiting for production deployments**

## 🛠️ Technology Stack

- **Frontend**: React 19.2.0
- **Build Tool**: Vite 6.2.0
- **AI**: Google Generative AI (@google/genai 1.29.0)
- **Language**: TypeScript 5.8.2

## 📁 Project Structure

```
sola-pdf-converter/
├── components/          # React components
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── ProductGrid.tsx
│   ├── ProductDetail.tsx
│   ├── About.tsx
│   └── Footer.tsx
├── services/           # API services
│   └── geminiService.ts
├── types.ts            # TypeScript type definitions
├── constants.ts        # App constants and tool definitions
├── index.css           # Global styles
├── App.tsx             # Main app component
├── index.tsx           # App entry point
├── vite.config.ts      # Vite configuration
├── .env.example        # Environment template
└── .gitignore          # Git ignore rules

```

## 🐛 Troubleshooting

### Blank White Page
✅ **FIXED** - CSS import was missing. Now properly imported in `index.tsx`

### API Errors
- Check that your `.env` file exists and has a valid `GEMINI_API_KEY`
- Verify your API key is active at https://aistudio.google.com/apikey
- Check browser console for detailed error messages

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (requires Node 18+)

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key from AI Studio |

## 🔐 Production Deployment Checklist

- [ ] Set up proper environment variables on hosting platform
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure CORS for your domain
- [ ] Set up API rate limiting
- [ ] Enable monitoring and error tracking
- [ ] Use production-grade secrets management
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Enable compression and caching
- [ ] Test all file conversion tools
- [ ] Set up backup API keys for failover

## 📄 License

Apache-2.0

---

**Created by Gregorious Creative Studios**
