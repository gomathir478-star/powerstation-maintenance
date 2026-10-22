<?php
require __DIR__ . '/config.php';

$resource = $_GET['resource'] ?? 'dashboard';
$method = $_SERVER['REQUEST_METHOD'];
$data = body();

try {
    switch ($resource) {
        case 'dashboard':
            $counts = [];
            $counts['equipment'] = (int)$pdo->query("SELECT COUNT(*) FROM equipment")->fetchColumn();
            $counts['active_alarms'] = (int)$pdo->query("SELECT COUNT(*) FROM alarms WHERE alarm_status <> 'Resolved'")->fetchColumn();
            $counts['open_repairs'] = (int)$pdo->query("SELECT COUNT(*) FROM repairs WHERE repair_status <> 'Completed'")->fetchColumn();
            $counts['technicians'] = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='Maintenance Worker' AND active=1")->fetchColumn();
            $counts['low_stock'] = (int)$pdo->query("SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level")->fetchColumn();
            $counts['recent_alarms'] = $pdo->query("SELECT a.alarm_id,a.severity,a.title,a.alarm_status,a.triggered_at,e.name AS equipment_name FROM alarms a JOIN equipment e ON e.equipment_id=a.equipment_id ORDER BY a.triggered_at DESC LIMIT 5")->fetchAll();
            respond($counts);

        case 'equipment':
            if ($method === 'GET') {
                respond($pdo->query("SELECT * FROM equipment ORDER BY equipment_id DESC")->fetchAll());
            }
            if ($method === 'POST') {
                required($data, ['equipment_code','name','equipment_type']);
                $stmt = $pdo->prepare("INSERT INTO equipment (equipment_code,name,equipment_type,location,installation_date,status) VALUES (?,?,?,?,?,?)");
                $stmt->execute([$data['equipment_code'],$data['name'],$data['equipment_type'],$data['location'] ?? '',$data['installation_date'] ?: null,$data['status'] ?? 'Operational']);
                respond(['message'=>'Equipment added','equipment_id'=>(int)$pdo->lastInsertId()], 201);
            }
            if ($method === 'PATCH') {
                required($data, ['equipment_id','status']);
                $stmt = $pdo->prepare("UPDATE equipment SET status=? WHERE equipment_id=?");
                $stmt->execute([$data['status'],$data['equipment_id']]);
                respond(['message'=>'Equipment status updated']);
            }
            break;

        case 'alarms':
            if ($method === 'GET') {
                respond($pdo->query("SELECT a.*,e.name AS equipment_name,e.equipment_code FROM alarms a JOIN equipment e ON e.equipment_id=a.equipment_id ORDER BY a.triggered_at DESC")->fetchAll());
            }
            if ($method === 'POST') {
                required($data, ['equipment_id','title']);
                $stmt=$pdo->prepare("INSERT INTO alarms (equipment_id,severity,title,message) VALUES (?,?,?,?)");
                $stmt->execute([$data['equipment_id'],$data['severity'] ?? 'Warning',$data['title'],$data['message'] ?? '']);
                respond(['message'=>'Alarm created','alarm_id'=>(int)$pdo->lastInsertId()],201);
            }
            if ($method === 'PATCH') {
                required($data, ['alarm_id','alarm_status']);
                $stmt=$pdo->prepare("UPDATE alarms SET alarm_status=?, resolved_at=IF(?='Resolved',NOW(),resolved_at) WHERE alarm_id=?");
                $stmt->execute([$data['alarm_status'],$data['alarm_status'],$data['alarm_id']]);
                respond(['message'=>'Alarm updated']);
            }
            break;

        case 'schedules':
            if ($method === 'GET') {
                respond($pdo->query("SELECT s.*,e.name AS equipment_name,u.full_name AS engineer_name FROM maintenance_schedules s JOIN equipment e ON e.equipment_id=s.equipment_id LEFT JOIN users u ON u.user_id=s.assigned_engineer_id ORDER BY s.scheduled_date ASC")->fetchAll());
            }
            if ($method === 'POST') {
                required($data, ['equipment_id','task_title','scheduled_date']);
                $stmt=$pdo->prepare("INSERT INTO maintenance_schedules (equipment_id,assigned_engineer_id,task_title,details,scheduled_date) VALUES (?,?,?,?,?)");
                $stmt->execute([$data['equipment_id'],$data['assigned_engineer_id'] ?: null,$data['task_title'],$data['details'] ?? '',$data['scheduled_date']]);
                respond(['message'=>'Maintenance scheduled','schedule_id'=>(int)$pdo->lastInsertId()],201);
            }
            if ($method === 'PATCH') {
                required($data, ['schedule_id','schedule_status']);
                $stmt=$pdo->prepare("UPDATE maintenance_schedules SET schedule_status=? WHERE schedule_id=?");
                $stmt->execute([$data['schedule_status'],$data['schedule_id']]);
                respond(['message'=>'Schedule status updated']);
            }
            break;

        case 'repairs':
            if ($method === 'GET') {
                respond($pdo->query("SELECT r.*,e.name AS equipment_name,u.full_name AS worker_name FROM repairs r JOIN equipment e ON e.equipment_id=r.equipment_id LEFT JOIN users u ON u.user_id=r.worker_id ORDER BY r.opened_at DESC")->fetchAll());
            }
            if ($method === 'POST') {
                required($data, ['equipment_id','issue_description']);
                $stmt=$pdo->prepare("INSERT INTO repairs (equipment_id,worker_id,issue_description,priority) VALUES (?,?,?,?)");
                $stmt->execute([$data['equipment_id'],$data['worker_id'] ?: null,$data['issue_description'],$data['priority'] ?? 'Medium']);
                $pdo->prepare("UPDATE equipment SET status='Under Maintenance' WHERE equipment_id=?")->execute([$data['equipment_id']]);
                respond(['message'=>'Repair work order created','repair_id'=>(int)$pdo->lastInsertId()],201);
            }
            if ($method === 'PATCH') {
                required($data, ['repair_id','repair_status']);
                $pdo->beginTransaction();
                $stmt=$pdo->prepare("UPDATE repairs SET repair_status=?, completed_at=IF(?='Completed',NOW(),completed_at) WHERE repair_id=?");
                $stmt->execute([$data['repair_status'],$data['repair_status'],$data['repair_id']]);
                if ($data['repair_status'] === 'Completed') {
                    $q=$pdo->prepare("SELECT equipment_id,worker_id,issue_description FROM repairs WHERE repair_id=?");
                    $q->execute([$data['repair_id']]); $r=$q->fetch();
                    if ($r) {
                        $pdo->prepare("UPDATE equipment SET status='Operational',last_maintenance_date=CURDATE() WHERE equipment_id=?")->execute([$r['equipment_id']]);
                        $pdo->prepare("INSERT INTO maintenance_history (equipment_id,technician_id,repair_id,maintenance_type,notes,maintenance_date) VALUES (?,?,?,?,?,CURDATE())")
                            ->execute([$r['equipment_id'],$r['worker_id'],$data['repair_id'],'Corrective repair',$r['issue_description']]);
                    }
                }
                $pdo->commit();
                respond(['message'=>'Repair status updated']);
            }
            break;

        case 'inventory':
            if ($method === 'GET') respond($pdo->query("SELECT * FROM inventory ORDER BY item_name")->fetchAll());
            if ($method === 'POST') {
                required($data, ['item_code','item_name']);
                $stmt=$pdo->prepare("INSERT INTO inventory (item_code,item_name,category,quantity,reorder_level,unit,supplier) VALUES (?,?,?,?,?,?,?)");
                $stmt->execute([$data['item_code'],$data['item_name'],$data['category'] ?? '',(int)($data['quantity'] ?? 0),(int)($data['reorder_level'] ?? 5),$data['unit'] ?? 'pcs',$data['supplier'] ?? '']);
                respond(['message'=>'Inventory item added'],201);
            }
            if ($method === 'PATCH') {
                required($data, ['item_id','quantity']);
                $stmt=$pdo->prepare("UPDATE inventory SET quantity=? WHERE item_id=?");
                $stmt->execute([(int)$data['quantity'],$data['item_id']]);
                respond(['message'=>'Stock quantity updated']);
            }
            break;

        case 'history':
            if ($method === 'GET') {
                respond($pdo->query("SELECT h.*,e.name AS equipment_name,u.full_name AS technician_name FROM maintenance_history h JOIN equipment e ON e.equipment_id=h.equipment_id LEFT JOIN users u ON u.user_id=h.technician_id ORDER BY h.maintenance_date DESC,h.history_id DESC")->fetchAll());
            }
            break;

        case 'users':
            if ($method === 'GET') {
                respond($pdo->query("SELECT user_id,full_name,email,role,phone,active,created_at FROM users ORDER BY full_name")->fetchAll());
            }
            if ($method === 'POST') {
                required($data, ['full_name','email','password','role']);
                $stmt=$pdo->prepare("INSERT INTO users (full_name,email,password_hash,role,phone) VALUES (?,?,?,?,?)");
                $stmt->execute([$data['full_name'],$data['email'],password_hash($data['password'],PASSWORD_DEFAULT),$data['role'],$data['phone'] ?? '']);
                respond(['message'=>'User created','user_id'=>(int)$pdo->lastInsertId()],201);
            }
            break;

        case 'reports':
            if ($method === 'GET') {
                $summary = [
                    'equipment_by_status'=>$pdo->query("SELECT status,COUNT(*) AS total FROM equipment GROUP BY status")->fetchAll(),
                    'repairs_by_status'=>$pdo->query("SELECT repair_status AS status,COUNT(*) AS total FROM repairs GROUP BY repair_status")->fetchAll(),
                    'inventory_low_stock'=>$pdo->query("SELECT item_name,quantity,reorder_level FROM inventory WHERE quantity <= reorder_level ORDER BY quantity")->fetchAll(),
                    'recent_history'=>$pdo->query("SELECT h.maintenance_date,h.maintenance_type,h.notes,e.name AS equipment_name FROM maintenance_history h JOIN equipment e ON e.equipment_id=h.equipment_id ORDER BY h.maintenance_date DESC LIMIT 10")->fetchAll()
                ];
                respond($summary);
            }
            break;
    }
    respond(['error'=>'Unsupported method or unknown resource'], 405);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ((string)$e->getCode() === '23000') respond(['error'=>'Duplicate value or related record constraint failed. Check IDs and unique fields.'],409);
    respond(['error'=>'Database operation failed. Check the submitted values and database schema.'],500);
} catch (Throwable $e) {
    respond(['error'=>'Unexpected server error.'],500);
}
