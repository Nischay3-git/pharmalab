INSERT INTO Roles (role_name, description) VALUES
('Administrator', 'Manage user accounts, roles, and reference data'),
('Laboratory Technician', 'Register batches, enter test results, record stability observations'),
('QC Officer', 'Review quality definitions and approve/reject batch results'),
('QA Officer', 'Investigate deviations and approve corrective actions'),
('Manager', 'Read-only access to quality performance reports and dashboards');

INSERT INTO Manufacturers (name, contact_email, contact_phone, address) VALUES
('Apex Pharma Ltd', 'quality@apexpharma.synthetic', '+1-555-0199', '120 Science Park, Boston, MA');

INSERT INTO Products (name, dosage_form, strength, manufacturer_id) VALUES
('Paracetamol', 'Tablet', '500 mg', 1),
('Amoxicillin', 'Capsule', '250 mg', 1);