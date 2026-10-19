-- ASBL-LAS D1 migration 0003: complete change audit coverage for the V2 data model.
CREATE TRIGGER IF NOT EXISTS audit_contributions_delete AFTER DELETE ON monthly_contributions BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('monthly_contributions',CAST(OLD.id AS TEXT),'DELETE',json_object('member_id',OLD.member_id,'year',OLD.contribution_year,'month',OLD.contribution_month,'amount',OLD.amount,'currency',OLD.currency),OLD.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_payments_delete AFTER DELETE ON member_payments BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('member_payments',OLD.id,'DELETE',json_object('member_id',OLD.member_id,'year',OLD.payment_year,'month',OLD.payment_month,'paid',OLD.paid),OLD.updated_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_posts_delete AFTER DELETE ON posts BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('posts',OLD.id,'DELETE',json_object('title',OLD.title,'category',OLD.category,'status',OLD.status),OLD.author_id);
END;
CREATE TRIGGER IF NOT EXISTS audit_comments_update AFTER UPDATE ON post_comments BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
 VALUES('post_comments',NEW.id,'UPDATE',json_object('status',OLD.status),json_object('status',NEW.status),NEW.author_id);
END;
CREATE TRIGGER IF NOT EXISTS audit_comments_delete AFTER DELETE ON post_comments BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('post_comments',OLD.id,'DELETE',json_object('post_id',OLD.post_id,'status',OLD.status),OLD.author_id);
END;
CREATE TRIGGER IF NOT EXISTS audit_media_insert AFTER INSERT ON media_items BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by)
 VALUES('media_items',CAST(NEW.id AS TEXT),'INSERT',json_object('media_type',NEW.media_type,'title',NEW.title,'status',NEW.status),NEW.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_media_update AFTER UPDATE ON media_items BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
 VALUES('media_items',CAST(NEW.id AS TEXT),'UPDATE',json_object('title',OLD.title,'status',OLD.status),json_object('title',NEW.title,'status',NEW.status),NEW.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_media_delete AFTER DELETE ON media_items BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('media_items',CAST(OLD.id AS TEXT),'DELETE',json_object('title',OLD.title,'status',OLD.status),OLD.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_periods_insert AFTER INSERT ON tontine_periods BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by)
 VALUES('tontine_periods',CAST(NEW.id AS TEXT),'INSERT',json_object('title',NEW.title,'starts_on',NEW.starts_on,'ends_on',NEW.ends_on,'status',NEW.status),NEW.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_periods_update AFTER UPDATE ON tontine_periods BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
 VALUES('tontine_periods',CAST(NEW.id AS TEXT),'UPDATE',json_object('status',OLD.status,'contribution_amount',OLD.contribution_amount),json_object('status',NEW.status,'contribution_amount',NEW.contribution_amount),NEW.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_periods_delete AFTER DELETE ON tontine_periods BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('tontine_periods',CAST(OLD.id AS TEXT),'DELETE',json_object('title',OLD.title,'status',OLD.status),OLD.created_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_entries_update AFTER UPDATE ON tontine_entries BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
 VALUES('tontine_entries',CAST(NEW.id AS TEXT),'UPDATE',json_object('status',OLD.status,'amount',OLD.amount),json_object('status',NEW.status,'amount',NEW.amount),NEW.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_entries_delete AFTER DELETE ON tontine_entries BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('tontine_entries',CAST(OLD.id AS TEXT),'DELETE',json_object('period_id',OLD.period_id,'member_id',OLD.member_id,'amount',OLD.amount,'status',OLD.status),OLD.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_aid_update AFTER UPDATE ON aid_requests BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
 VALUES('aid_requests',CAST(NEW.id AS TEXT),'UPDATE',json_object('status',OLD.status,'decision_note',OLD.decision_note),json_object('status',NEW.status,'decision_note',NEW.decision_note),NEW.decided_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_aid_delete AFTER DELETE ON aid_requests BEGIN
 INSERT INTO audit_logs(table_name,record_id,action,old_data,changed_by)
 VALUES('aid_requests',CAST(OLD.id AS TEXT),'DELETE',json_object('member_id',OLD.member_id,'subject',OLD.subject,'status',OLD.status),OLD.decided_by);
END;
