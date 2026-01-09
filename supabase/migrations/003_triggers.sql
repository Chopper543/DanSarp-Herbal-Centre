-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'update';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    old_data := to_jsonb(OLD);
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', old_data,
      'new', new_data
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_reviews
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_admin_invites
  AFTER INSERT OR UPDATE OR DELETE ON admin_invites
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to sync auth.users with users table
CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at = NOW();

  -- Create profile if it doesn't exist
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_from_auth();

-- Function to update payment ledger
CREATE OR REPLACE FUNCTION update_payment_ledger()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(10, 2);
  transaction_type_val transaction_type;
BEGIN
  -- Determine transaction type based on payment status
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    transaction_type_val := 'payment';
    
    -- Calculate current balance (sum of all completed payments)
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id AND status = 'completed';
    
    -- Insert ledger entry
    INSERT INTO payment_ledger (
      payment_id,
      transaction_type,
      amount,
      balance_after
    ) VALUES (
      NEW.id,
      transaction_type_val,
      NEW.amount,
      current_balance
    );
  ELSIF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    transaction_type_val := 'refund';
    
    -- Calculate current balance after refund
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id 
      AND status = 'completed'
      AND id != NEW.id;
    
    -- Insert ledger entry for refund
    INSERT INTO payment_ledger (
      payment_id,
      transaction_type,
      amount,
      balance_after
    ) VALUES (
      NEW.id,
      transaction_type_val,
      -NEW.amount,
      current_balance
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payment ledger
CREATE TRIGGER on_payment_status_change
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_payment_ledger();
