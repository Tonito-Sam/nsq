# aramex-nexsq-api-server

A .NET Core Web API backend for integrating with Aramex JSON REST APIs. This project provides endpoints for waybill submission, rate calculation, collection submission, tracking, and lookups, acting as a middleware between your frontend and Aramex's services.

## Features
- Organized controllers: Waybill, Rate, Collection, Tracking, Lookup
- Secure authentication handling
- Example endpoints for all major Aramex API operations

## Getting Started
1. Restore dependencies:
   ```
dotnet restore
   ```
2. Build the project:
   ```
dotnet build
   ```
3. Run the API server:
   ```
dotnet run
   ```

## Project Structure
- `Controllers/` - API controllers for each Aramex operation
- `Models/` - Data models for requests and responses
- `Services/` - Logic for calling Aramex JSON APIs

## Next Steps
- Implement each controller and endpoint as per Aramex API documentation
- Configure authentication securely (do not hardcode credentials)

---

For more details, see the Aramex API documentation provided in your project notes.
