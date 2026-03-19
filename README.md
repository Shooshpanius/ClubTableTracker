# ClubTableTracker

A full-stack club table reservation management application built with ASP.NET Core and React + TypeScript + Vite.

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Shooshpanius/ClubTableTracker.git
   cd ClubTableTracker
   ```

2. Install frontend dependencies:
   ```bash
   cd clubtabletracker.client
   npm install
   ```

3. Configure environment variables — copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp clubtabletracker.client/.env.example clubtabletracker.client/.env
   ```

4. Open `ClubTableTracker.slnx` in Visual Studio 2022 and run the solution, or start each part manually:
   - Backend: `dotnet run --project ClubTableTracker.Server`
   - Frontend: `cd clubtabletracker.client && npm run dev`

> **Note:** Always run `npm install` in the `clubtabletracker.client` directory after cloning or pulling changes that update `package.json`. Missing this step causes Vite to report `Failed to resolve import` errors.