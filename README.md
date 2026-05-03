# Travel Companion

Travel Companion is a mobile application that centralizes everything a traveler needs into a single, lightweight, offline-first app: itinerary planning, interactive offline maps, curated local recommendations, a local language cheat sheet, and an on-device AI travel assistant. Travelers no longer need to juggle multiple disconnected services or worry about poor connectivity abroad.

## Prerequisite

- Install Node.js <https://nodejs.org/en/download>
- Install pnpm <https://pnpm.io/installation>
- Install bun <https://bun.com/docs/installation#overview>
- Install Expo Go (SDK 55) <https://expo.dev/go>
- Install Biome extension
  - VS Code: <https://marketplace.visualstudio.com/items?itemName=biomejs.biome>
  - Cursor, etc: <https://open-vsx.org/extension/biomejs/biome>
- Install Prisma extension
- Setup Biome
  - Create a .vscode or .cursor folder in the root directory
  - In that folder create a file called `settings.json`
  - Add the following lines to `settings.json`

    ```json
    {
      "editor.defaultFormatter": "biomejs.biome",
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": {
          "source.fixAll.biome": "explicit",
          "source.organizeImports.biome": "explicit"
      }
    }
    ```

## Project Setup

- Open a new terminal
- Enter the following commands:
  - `git clone https://github.com/heavydriver/travel-companion.git`
  - `cd travel-companion`
  - `pnpm i`
- Create a `.env`files in project root and the `apps/api` folder
  - Copy the variables from `.env.example` and fill the values

## React Native Async Storage Setup

- Open a new terminal in the travel-companion folder
- Enter the following commands:
  - `cd apps/mobile`
  - `pnpx expo prebuild`
- If using android emulator:
  - Open `mobile/android/build.gradle`
  - Add this to it:

  ```groovy
  allprojects {
    repositories {
        // ... others like google(), mavenCentral()

        maven {
            url = uri(project(":react-native-async-storage_async-storage").file("local_repo"))
            // or uri("path/to/node_modules/@react-native-async-storage/async-storage/android/local_repo")
        }
    }
  }
  ```

- If using iOS
  - `cd ios`
  - `pod install`

## Project Organization

- `./apps/api` - contains backend code
- `./apps/mobile` - contains react native code
- `./packages` - contains packages that are used by both api and mobile
- `./packages/db/generated/prisma` - contains models/types from schema
- `./packages/db/generated/prismabox` - contains Typebox (ElysiaJS) types

## Running the Project

### Start both backend and frontend

- Open a new terminal in the travel-companion (project root) folder
- Enter the following command:
  - `pnpm run dev`

### Start backend

- Open a new terminal in the travel-companion folder
- Enter the following commands:
  - `cd apps/api`
  - `pnpm run dev`

### Start mobile app

- Open a new terminal in the travel-companion folder
- Enter the following commands:
  - `cd apps/mobile`
  - `pnpm run start`
- Use Expo Go to scan the qr code and test the app for general app work
  - Alternatively, can run emulator on your computer
  - press `a` for android or `i` for iOS
- Google Sign-In requires a development build and will not work in Expo Go
  - add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to `apps/mobile/.env`
  - make sure `apps/api/.env` uses the same value for `GOOGLE_CLIENT_ID`
  - rebuild native Android after config changes with `npx expo run:android`

## Git Commands

- Create a new branch - `git checkout -b <branch-name>` (the branch name should clearly indicate the purpose of the branch (e.g., bugfix, new feature, documentation update), remove the angle brackets <, >)

- Make changes to your code, add your changes with `git add .` (adds all new/modified files to staging area)

- Commit your code - `git commit -m "some message"`

- Push your code to GitHub - `git push origin <branch-name>`

- Occasionally do `git pull origin main` to sync with the main branch (always `commit` your changes before running a `git pull`)
