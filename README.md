# Intrusion Detection System (IDS) for CAN Bus Analysis

A comprehensive intrusion detection system designed for analyzing and managing CAN bus data patterns, built with modern web technologies and enterprise-grade security features.

## Features

### 🔐 Security & Authentication
- **Session Management**: Secure session handling with automatic cleanup
- **Browser History Protection**: Prevents back navigation and clears sensitive data

### 🎨 User Interface
- **Modern Bootstrap 5.3.8 Interface**: Responsive, mobile-friendly design
- **FontAwesome 6.7.2 Icons**: Professional iconography throughout the interface
- **Dual-Page System**: Separate interfaces for normal CAN data and attack pattern management
- **Label Filtering**: Radio button controls to filter by Label = 0, Label = 1, or Both
- **Real-time Search**: Instant search and filtering capabilities with clear search functionality
- **Export to CSV**: Download data in CSV format with proper formatting

### 🛠️ Technical Features
- **Generic REST API**: Works with any table structure without hardcoding
- **Dynamic Field Type Inference**: Automatically detects field types (hex, datetime, select, textarea, number)
- **Label-Based Filtering**: Server-side filtering by Label field with pagination support
- **Memory Management**: Proper state management for filtered data and pagination
- **Client-side & Server-side Validation**: Comprehensive data validation
- **Graceful Server Shutdown**: Proper resource cleanup and session management
- **Error Handling**: Robust error handling with user-friendly messages

## Database Schema

The system uses two main tables for CAN bus data analysis:

### Normal CAN Data Table (`normalCAN`)
- **Label** - Data classification label (INTEGER: 0 = normal, 1 = attack)
- **Time** - Timestamp of the CAN message (REAL: Unix timestamp with milliseconds)
- **ID** - CAN message identifier (TEXT: CAN ID in hex format)
- **Signal1_of_ID** - First signal value for this CAN ID (REAL: normalized signal value)
- **Signal2_of_ID** - Second signal value for this CAN ID (REAL: normalized signal value)
- **Signal3_of_ID** - Third signal value for this CAN ID (INTEGER: discrete signal value)
- **Signal4_of_ID** - Fourth signal value for this CAN ID (REAL: normalized signal value)

### Suppress CAN Attack Data Table (`suppressCANattack`)
- **Label** - Data classification label (INTEGER: 0 = normal, 1 = attack)
- **Time** - Timestamp of the CAN message (REAL: Unix timestamp with milliseconds)
- **ID** - CAN message identifier (TEXT: CAN ID in hex format)
- **Signal1_of_ID** - First signal value for this CAN ID (REAL: normalized signal value)
- **Signal2_of_ID** - Second signal value for this CAN ID (INTEGER: discrete signal value)
- **Signal3_of_ID** - Third signal value for this CAN ID (INTEGER: discrete signal value)
- **Signal4_of_ID** - Fourth signal value for this CAN ID (REAL: normalized signal value)

### Data Characteristics
- **Label Field**: Used for filtering and classification (0 = normal traffic, 1 = attack patterns)
- **Time Field**: High-precision timestamps for temporal analysis
- **ID Field**: CAN message identifiers in hexadecimal format
- **Signal Fields**: Multiple signal values per CAN ID for comprehensive analysis
- **Data Volume**: Large datasets with millions of records for machine learning analysis

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **SQLite3**
- **Database file** (standard SQLite database)

## Installation

1. **Clone or copy the project** to your desired location
2. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

The application uses a configuration system for all parameters. Create a `.config` file in the application directory:

```ini
# Database Configuration
DB_FILENAME=idspatternsdb.db
DB_DIRECTORY=.
SERVER_PORT=9008
```

### Configuration Parameters

#### Database Configuration
- **`DB_FILENAME`** - Database file name (default: `idspatternsdb.db`)
- **`DB_DIRECTORY`** - Directory path relative to application (default: `.` for current directory)
- **`DB_ABSOLUTE_PATH`** - Alternative: absolute path to database file

#### Server Configuration
- **`SERVER_PORT`** - Port number for the web server (default: `9008`)


## Usage

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Access the application:**
   - Open your browser and navigate to `http://localhost:9008`
   - You will have immediate access to the system

4. **Manage CAN Data:**
   - **Normal CAN Data**: View, add, edit, and delete normal CAN bus messages
   - **Suppress CAN Attack Data**: Manage attack patterns and suppression rules

## Application Pages

### Normal CAN Data Page (`/`)
- View all normal CAN bus messages with label filtering
- Filter by Label = 0, Label = 1, or Both using radio buttons
- Add new CAN data entries
- Edit existing CAN data (maintains filter context)
- Search and filter CAN messages
- Export data to CSV
- Paginated display with 25 rows per page

### Suppress CAN Attack Data Page (`/suppress.html`)
- View all attack patterns with label filtering
- Filter by Label = 0, Label = 1, or Both using radio buttons
- Add new attack patterns
- Edit existing attack patterns (maintains filter context)
- Configure suppression actions
- Search and filter attack data
- Export attack data to CSV
- Paginated display with 25 rows per page

## API Endpoints

### Data Management
- `GET /api/:table` - Fetch all rows from a table
- `GET /api/:table?limit=25&offset=0&label=0` - Fetch paginated rows with optional label filtering
- `GET /api/:table/:id` - Fetch a specific row by ID
- `POST /api/:table` - Create a new row
- `PUT /api/:table/:id` - Update an existing row
- `DELETE /api/:table/:id` - Delete a row
- `GET /api/:table/meta` - Get table metadata

### Search & Filtering
- `GET /api/:table/search?q=query` - Search within table data
- `GET /api/:table?label=0` - Filter by Label = 0 (normal traffic)
- `GET /api/:table?label=1` - Filter by Label = 1 (attack patterns)
- `GET /api/:table` - Show both Label = 0 and Label = 1 (default)

## Security Features

### 🛡️ Application Security
- **Input Validation**: Comprehensive validation on both client and server
- **Error Handling**: Secure error messages without information leakage

## File Structure

```
IDSAPP/
├── public/
│   ├── index.html          # Normal CAN Data interface
│   ├── suppress.html       # Attack pattern management interface
│   └── kirahi-logo.png     # Application logo
├── js/
│   ├── canmgmtapp.mjs      # Normal CAN data management logic
│   ├── attackmgmtapp.mjs   # Attack pattern management logic
│   ├── htmlhelpers.mjs     # HTML generation utilities
│   ├── validation.mjs      # Form validation
│   ├── restcallsfordbdata.mjs # API communication
│   └── config.mjs          # Configuration management
├── css/
│   └── style.css           # Custom styles
├── server.js               # Express server
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## Troubleshooting

### Database Connection Issues
- Verify the database file exists and is accessible
- Verify SQLite3 is properly installed

### Server Issues
- Check that port 9008 is available
- Verify all dependencies are installed correctly
- Check server logs for detailed error messages
- Ensure Node.js version compatibility

### Browser Issues
- Clear browser cache and cookies
- Ensure JavaScript is enabled
- Check browser console for client-side errors

## Development

The system is built on a generic, extensible infrastructure:

### Customization Options
- **Field Type Inference**: Customize field type detection for different data types
- **Validation Rules**: Extend validation logic for specific requirements
- **UI Themes**: Modify CSS for custom styling
- **API Extensions**: Add new endpoints for additional functionality
- **Database Schema**: Adapt to different table structures

### Architecture
- **Modular Design**: Clean separation of concerns
- **ES Modules**: Modern JavaScript module system
- **Dynamic Forms**: Schema-driven form generation
- **Generic API**: Table-agnostic data operations

## Performance

- **High Performance**: Uses better-sqlite3 for optimal database performance
- **Memory Efficient**: Automatic cleanup of sensitive data
- **Responsive UI**: Optimized for various screen sizes
- **Fast Search**: Real-time search with efficient filtering

## License

ISC License - Copyright (c) 2025, Kirahi LLC
Max Seenisamy kirahi.com

## Support

For technical support, feature requests, or security concerns, please contact the developer max@kirahi.com