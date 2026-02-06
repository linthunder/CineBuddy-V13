// --- CINEBUDDY API BACKEND V13.0 (WORKFLOW) ---

add_action('init', 'cb_setup_tables_v13');
function cb_setup_tables_v13() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();

    // 1. Criação/Verificação de Tabelas
    $sql = [
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_projects (id mediumint(9) NOT NULL AUTO_INCREMENT, job_id varchar(20), title varchar(255), agency varchar(255), client varchar(255), duration varchar(50), status_initial varchar(20) DEFAULT 'open', status_final varchar(20) DEFAULT 'locked', status_closing varchar(20) DEFAULT 'locked', updated_at datetime DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_budget_lines (id mediumint(9) NOT NULL AUTO_INCREMENT, project_id mediumint(9), stage varchar(50), department varchar(100), role_function varchar(100), item_name varchar(255), unit_type varchar(20), unit_cost decimal(10,2), extra_cost decimal(10,2), quantity decimal(10,2), total_cost decimal(10,2), real_unit_cost decimal(10,2) DEFAULT 0, real_extra_cost decimal(10,2) DEFAULT 0, real_quantity decimal(10,2) DEFAULT 0, real_total_cost decimal(10,2) DEFAULT 0, pay_status varchar(20) DEFAULT 'pendente', pay_date date, pay_doc varchar(50), pay_obs text, PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_professionals (id mediumint(9) NOT NULL AUTO_INCREMENT, name varchar(255), role_default varchar(100), cpf varchar(20), rg varchar(20), phone varchar(50), email varchar(100), address text, cnpj varchar(30), pix_key varchar(100), bank varchar(100), agency varchar(20), account varchar(30), daily_rate decimal(10,2), weekly_rate decimal(10,2), PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_company (id mediumint(9) NOT NULL AUTO_INCREMENT, company_name varchar(255), fantasy_name varchar(255), cnpj varchar(30), address text, phone varchar(50), email varchar(100), website varchar(100), PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_app_users (id mediumint(9) NOT NULL AUTO_INCREMENT, name varchar(255), email varchar(100), role varchar(50), password varchar(255), PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_logs (id mediumint(9) NOT NULL AUTO_INCREMENT, user_name varchar(100), action varchar(255), details text, created_at datetime DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) $charset;",
        "CREATE TABLE IF NOT EXISTS wp_cinebuddy_roles (id mediumint(9) NOT NULL AUTO_INCREMENT, role_name varchar(255), department varchar(100), base_rate decimal(10,2), PRIMARY KEY (id)) $charset;"
    ];
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    foreach ($sql as $query) { $wpdb->query($query); }

    // 2. Auto-Migração (Segurança)
    $cols_proj = $wpdb->get_col("DESCRIBE wp_cinebuddy_projects");
    if (!in_array('status_initial', $cols_proj)) { $wpdb->query("ALTER TABLE wp_cinebuddy_projects ADD status_initial varchar(20) DEFAULT 'open'"); }
    if (!in_array('status_final', $cols_proj)) { $wpdb->query("ALTER TABLE wp_cinebuddy_projects ADD status_final varchar(20) DEFAULT 'locked'"); }
    if (!in_array('status_closing', $cols_proj)) { $wpdb->query("ALTER TABLE wp_cinebuddy_projects ADD status_closing varchar(20) DEFAULT 'locked'"); }
    
    $cols_lines = $wpdb->get_col("DESCRIBE wp_cinebuddy_budget_lines");
    if (!in_array('pay_status', $cols_lines)) { $wpdb->query("ALTER TABLE wp_cinebuddy_budget_lines ADD pay_status varchar(20) DEFAULT 'pendente', ADD pay_date date, ADD pay_doc varchar(50), ADD pay_obs text"); }
    if (!in_array('real_unit_cost', $cols_lines)) { $wpdb->query("ALTER TABLE wp_cinebuddy_budget_lines ADD real_unit_cost decimal(10,2) DEFAULT 0, ADD real_extra_cost decimal(10,2) DEFAULT 0, ADD real_quantity decimal(10,2) DEFAULT 0, ADD real_total_cost decimal(10,2) DEFAULT 0"); }
}

// 3. Save Project
add_action('wp_ajax_cb_save_project', 'cb_save_project_v13');
add_action('wp_ajax_nopriv_cb_save_project', 'cb_save_project_v13');
function cb_save_project_v13() {
    global $wpdb;
    $name = isset($_POST['title']) ? sanitize_text_field($_POST['title']) : '';
    $agency = isset($_POST['agency']) ? sanitize_text_field($_POST['agency']) : '';
    $client = isset($_POST['client']) ? sanitize_text_field($_POST['client']) : '';
    $duration = isset($_POST['duration']) ? sanitize_text_field($_POST['duration']) : '';
    $current_job_id = (isset($_POST['current_job_id']) && $_POST['current_job_id'] !== 'null') ? sanitize_text_field($_POST['current_job_id']) : '';

    if (empty($name)) { wp_send_json_error(array('message' => 'Nome obrigatório')); wp_die(); }

    if (!empty($current_job_id)) {
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, status_initial, status_final, status_closing FROM wp_cinebuddy_projects WHERE job_id = %s", $current_job_id));
        if ($existing) {
            $wpdb->update('wp_cinebuddy_projects', 
                array('title'=>$name, 'agency'=>$agency, 'client'=>$client, 'duration'=>$duration, 'updated_at'=>current_time('mysql')),
                array('id'=>$existing->id)
            );
            wp_send_json_success(array('job_id' => $current_job_id, 'message' => 'Atualizado', 'status' => ['initial'=>$existing->status_initial, 'final'=>$existing->status_final, 'closing'=>$existing->status_closing]));
            wp_die();
        }
    }
    
    $last_id = $wpdb->get_var("SELECT id FROM wp_cinebuddy_projects ORDER BY id DESC LIMIT 1");
    $new_id_num = intval($last_id) + 1;
    $job_code = '#BZ' . str_pad($new_id_num, 4, '0', STR_PAD_LEFT);
    
    $wpdb->insert('wp_cinebuddy_projects', array(
        'job_id' => $job_code, 'title' => $name, 'agency' => $agency, 'client' => $client, 'duration' => $duration,
        'status_initial' => 'open', 'status_final' => 'locked', 'status_closing' => 'locked'
    ));
    
    wp_send_json_success(array('job_id' => $job_code, 'message' => 'Criado', 'status' => ['initial'=>'open', 'final'=>'locked', 'closing'=>'locked']));
    wp_die();
}

// 4. Update Status (Workflow Logic)
add_action('wp_ajax_cb_update_stage_status', 'cb_update_stage_v13');
add_action('wp_ajax_nopriv_cb_update_stage_status', 'cb_update_stage_v13');
function cb_update_stage_v13() {
    global $wpdb;
    $jid = sanitize_text_field($_POST['job_id']);
    $stage = sanitize_text_field($_POST['stage']); 
    $status = sanitize_text_field($_POST['status']);
    
    $data = array('status_' . $stage => $status);
    
    if ($stage === 'initial' && $status === 'locked') $data['status_final'] = 'open';
    if ($stage === 'final' && $status === 'locked') $data['status_closing'] = 'open';

    $wpdb->update('wp_cinebuddy_projects', $data, array('job_id' => $jid));
    wp_send_json_success();
    wp_die();
}

// 5. Save Lines
add_action('wp_ajax_cb_save_budget_lines', 'cb_lines_v13'); add_action('wp_ajax_nopriv_cb_save_budget_lines', 'cb_lines_v13');
function cb_lines_v13() {
    global $wpdb;
    $jid = sanitize_text_field($_POST['job_id']);
    $lines = json_decode(stripslashes($_POST['lines']), true);
    $pid = $wpdb->get_var($wpdb->prepare("SELECT id FROM wp_cinebuddy_projects WHERE job_id = %s", $jid));
    
    if(!$pid) { wp_send_json_error(['message'=>'Projeto não encontrado']); wp_die(); }

    $old_lines = $wpdb->get_results($wpdb->prepare("SELECT role_function, item_name, real_unit_cost, real_extra_cost, real_quantity, real_total_cost, pay_status, pay_date, pay_doc FROM wp_cinebuddy_budget_lines WHERE project_id = %d", $pid), ARRAY_A);
    $wpdb->delete('wp_cinebuddy_budget_lines', array('project_id' => $pid));
    
    if (is_array($lines)) {
        foreach ($lines as $l) {
            $real = ['real_unit_cost'=>0, 'real_extra_cost'=>0, 'real_quantity'=>0, 'real_total_cost'=>0, 'pay_status'=>'pendente', 'pay_doc'=>''];
            if($old_lines) {
                foreach($old_lines as $o) {
                    if (($o['role_function'] == $l['role'] && $l['role']!='') || ($o['item_name'] == $l['name'] && $l['name']!='')) { $real = $o; break; }
                }
            }
            $wpdb->insert('wp_cinebuddy_budget_lines', array(
                'project_id' => $pid, 'stage' => 'initial', 'department' => sanitize_text_field($l['department']),
                'role_function' => sanitize_text_field($l['role']), 'item_name' => sanitize_text_field($l['name']),
                'unit_type' => sanitize_text_field($l['type']), 'unit_cost' => floatval($l['rate']),
                'extra_cost' => floatval($l['travel']), 'quantity' => floatval($l['qty']), 'total_cost' => floatval($l['total']),
                'real_unit_cost' => $real['real_unit_cost'], 'real_extra_cost' => $real['real_extra_cost'], 'real_quantity' => $real['real_quantity'], 'real_total_cost' => $real['real_total_cost'],
                'pay_status' => $real['pay_status'], 'pay_doc' => $real['pay_doc']
            ));
        }
    }
    wp_send_json_success(); wp_die();
}

// 6. Save Realized
add_action('wp_ajax_cb_save_realized', 'cb_realized_v13'); add_action('wp_ajax_nopriv_cb_save_realized', 'cb_realized_v13');
function cb_realized_v13() {
    global $wpdb;
    $lines = json_decode(stripslashes($_POST['lines']), true);
    if (is_array($lines)) {
        foreach ($lines as $l) {
            if(intval($l['id']) > 0) {
                $d = array('real_unit_cost'=>floatval($l['real_rate']),'real_extra_cost'=>floatval($l['real_travel']),'real_quantity'=>floatval($l['real_qty']),'real_total_cost'=>floatval($l['real_total']));
                if(isset($l['pay_status'])) $d['pay_status'] = $l['pay_status'];
                if(isset($l['pay_doc'])) $d['pay_doc'] = $l['pay_doc'];
                if(isset($l['pay_date'])) $d['pay_date'] = $l['pay_date'];
                $wpdb->update('wp_cinebuddy_budget_lines', $d, array('id'=>intval($l['id'])));
            }
        }
    }
    wp_send_json_success(); wp_die();
}

// 7. Getters & Utils
add_action('wp_ajax_cb_get_budget_lines', 'cb_get_v13'); add_action('wp_ajax_nopriv_cb_get_budget_lines', 'cb_get_v13');
function cb_get_v13() { global $wpdb; $jid = sanitize_text_field($_GET['job_id']);
    $proj = $wpdb->get_row($wpdb->prepare("SELECT id, status_initial, status_final, status_closing FROM wp_cinebuddy_projects WHERE job_id = %s", $jid));
    if(!$proj) { wp_send_json_error(['message'=>'404']); wp_die(); }
    $res = $wpdb->get_results($wpdb->prepare("SELECT * FROM wp_cinebuddy_budget_lines WHERE project_id = %d", $proj->id)); 
    wp_send_json_success(array('lines'=>$res, 'status'=>['initial'=>$proj->status_initial, 'final'=>$proj->status_final, 'closing'=>$proj->status_closing])); wp_die(); }

add_action('wp_ajax_cb_list_projects', 'cb_list_v13'); add_action('wp_ajax_nopriv_cb_list_projects', 'cb_list_v13');
function cb_list_v13() { global $wpdb; $res = $wpdb->get_results("SELECT id, job_id, title, client, updated_at FROM wp_cinebuddy_projects ORDER BY updated_at DESC LIMIT 50"); wp_send_json_success($res ? $res : []); wp_die(); }

add_action('wp_ajax_cb_get_pros', 'cb_gp_v13'); add_action('wp_ajax_nopriv_cb_get_pros', 'cb_gp_v13'); function cb_gp_v13(){global $wpdb;wp_send_json_success($wpdb->get_results($wpdb->prepare("SELECT * FROM wp_cinebuddy_professionals WHERE name LIKE %s LIMIT 10",'%'.$_GET['term'].'%')));wp_die();}
add_action('wp_ajax_cb_get_roles', 'cb_gr_v13'); add_action('wp_ajax_nopriv_cb_get_roles', 'cb_gr_v13'); function cb_gr_v13(){global $wpdb;wp_send_json_success($wpdb->get_results($wpdb->prepare("SELECT * FROM wp_cinebuddy_roles WHERE role_name LIKE %s LIMIT 10",'%'.$_GET['term'].'%')));wp_die();}
add_action('wp_ajax_cb_save_company', 'cb_sc_v13'); add_action('wp_ajax_nopriv_cb_save_company', 'cb_sc_v13'); function cb_sc_v13(){ global $wpdb; $d=$_POST; unset($d['action']); if($wpdb->get_var("SELECT id FROM wp_cinebuddy_company WHERE id=1")) $wpdb->update('wp_cinebuddy_company',$d,array('id'=>1)); else $wpdb->insert('wp_cinebuddy_company',$d); wp_send_json_success(); wp_die();}
add_action('wp_ajax_cb_save_professional', 'cb_sp_v13'); add_action('wp_ajax_nopriv_cb_save_professional', 'cb_sp_v13'); function cb_sp_v13(){global $wpdb;$d=$_POST;$id=intval($d['id']);unset($d['action'],$d['id']);if($id>0)$wpdb->update('wp_cinebuddy_professionals',$d,array('id'=>$id));else $wpdb->insert('wp_cinebuddy_professionals',$d);wp_send_json_success();wp_die();}
add_action('wp_ajax_cb_list_professionals', 'cb_lp_v13'); add_action('wp_ajax_nopriv_cb_list_professionals', 'cb_lp_v13'); function cb_lp_v13(){global $wpdb;wp_send_json_success($wpdb->get_results("SELECT * FROM wp_cinebuddy_professionals ORDER BY name ASC"));wp_die();}
