-- 1. Roles Reference Table
CREATE TABLE Roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL
);

-- 2. Users Table
CREATE TABLE Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

-- 3. Manufacturers Table
CREATE TABLE Manufacturers (
    manufacturer_id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NULL,
    contact_phone VARCHAR(50) NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- 4. Products Table
CREATE TABLE Products (
    product_id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    dosage_form VARCHAR(50) NOT NULL,
    strength VARCHAR(50) NOT NULL,
    manufacturer_id INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Products_Manufacturers FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id)
);

-- 5. Batches Table
CREATE TABLE Batches (
    batch_id INT IDENTITY(1,1) PRIMARY KEY,
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    product_id INT NOT NULL,
    manufacture_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Registered',
    created_by INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Batches_Products FOREIGN KEY (product_id) REFERENCES Products(product_id),
    CONSTRAINT FK_Batches_Users FOREIGN KEY (created_by) REFERENCES Users(user_id),
    CONSTRAINT CHK_Batch_Dates CHECK (expiry_date > manufacture_date),
    CONSTRAINT CHK_Batch_Status CHECK (status IN ('Registered', 'In Testing', 'Approved', 'Rejected', 'Quarantined'))
);

-- 6. Indexes
CREATE INDEX IX_Batches_Product_Id ON Batches(product_id);
CREATE INDEX IX_Batches_Status ON Batches(status);