CREATE DATABASE IF NOT EXISTS psms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE psms;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin','Engineer','Maintenance Worker') NOT NULL DEFAULT 'Engineer',
  phone VARCHAR(25),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  equipment_type VARCHAR(80) NOT NULL,
  location VARCHAR(120),
  installation_date DATE NULL,
  status ENUM('Operational','Warning','Faulty','Under Maintenance','Offline') NOT NULL DEFAULT 'Operational',
  last_maintenance_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alarms (
  alarm_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  severity ENUM('Info','Warning','Critical') NOT NULL DEFAULT 'Warning',
  title VARCHAR(160) NOT NULL,
  message TEXT,
  alarm_status ENUM('Active','Acknowledged','Resolved') NOT NULL DEFAULT 'Active',
  triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_alarm_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  assigned_engineer_id INT NULL,
  task_title VARCHAR(160) NOT NULL,
  details TEXT,
  scheduled_date DATE NOT NULL,
  schedule_status ENUM('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_engineer FOREIGN KEY (assigned_engineer_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS repairs (
  repair_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  worker_id INT NULL,
  alarm_id INT NULL,
  issue_description TEXT NOT NULL,
  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  repair_status ENUM('Pending','In Progress','Completed','Blocked') NOT NULL DEFAULT 'Pending',
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_repair_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_worker FOREIGN KEY (worker_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_repair_alarm FOREIGN KEY (alarm_id) REFERENCES alarms(alarm_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(40) NOT NULL UNIQUE,
  item_name VARCHAR(140) NOT NULL,
  category VARCHAR(80),
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 5,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  supplier VARCHAR(140),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  technician_id INT NULL,
  repair_id INT NULL,
  maintenance_type VARCHAR(100) NOT NULL,
  notes TEXT,
  maintenance_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE,
  CONSTRAINT fk_history_technician FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_history_repair FOREIGN KEY (repair_id) REFERENCES repairs(repair_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  report_title VARCHAR(160) NOT NULL,
  report_type VARCHAR(80) NOT NULL,
  generated_by INT NULL,
  report_period VARCHAR(80),
  report_notes TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_user FOREIGN KEY (generated_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Demo users. Password hashes below are generated for the password: password
INSERT IGNORE INTO users (full_name,email,password_hash,role,phone) VALUES
('System Admin','admin@psms.local','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Admin','9000000001'),
('Arun Engineer','engineer@psms.local','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Engineer','9000000002'),
('Kavin Worker','worker@psms.local','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Maintenance Worker','9000000003');

INSERT IGNORE INTO equipment (equipment_code,name,equipment_type,location,installation_date,status,last_maintenance_date) VALUES
('GEN-001','Generator Unit 01','Generator','Power Block A','2022-04-10','Operational','2026-09-14'),
('TRF-002','Transformer Unit 02','Transformer','Substation B','2021-11-20','Warning','2026-08-21'),
('TUR-003','Steam Turbine 03','Turbine','Power Block A','2020-06-05','Under Maintenance','2026-10-02'),
('PMP-004','Cooling Pump 04','Pump','Cooling Section','2023-02-12','Operational','2026-07-19');

INSERT INTO alarms (equipment_id,severity,title,message,alarm_status,triggered_at)
SELECT equipment_id,'Critical','High temperature detected','Temperature exceeded configured threshold. Inspect equipment before returning it to service.','Active',NOW()
FROM equipment WHERE equipment_code='TRF-002'
AND NOT EXISTS (SELECT 1 FROM alarms WHERE title='High temperature detected');

INSERT INTO inventory (item_code,item_name,category,quantity,reorder_level,unit,supplier) VALUES
('SP-001','Cooling Fan','Electrical',3,5,'pcs','Power Parts Ltd'),
('SP-002','Bearing Set','Mechanical',12,4,'sets','Industrial Spares'),
('SP-003','Insulation Kit','Electrical',2,5,'kits','Grid Supplies')
ON DUPLICATE KEY UPDATE item_name=VALUES(item_name);
