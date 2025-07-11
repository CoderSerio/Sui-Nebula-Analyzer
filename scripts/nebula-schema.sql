-- NebulaGraph 图模式定义
-- 创建图空间
CREATE SPACE IF NOT EXISTS sui_analysis (
  partition_num = 10,
  replica_factor = 1,
  vid_type = FIXED_STRING(64)
);

USE sui_analysis;

-- 创建标签（节点类型）
CREATE TAG IF NOT EXISTS wallet (
  address string NOT NULL,
  first_seen datetime,
  last_seen datetime,
  transaction_count int DEFAULT 0,
  total_amount double DEFAULT 0.0,
  is_contract bool DEFAULT false,
  sui_balance double DEFAULT 0.0,
  owned_objects_count int DEFAULT 0,
  last_activity datetime
);

-- 创建边类型（交易关系）
CREATE EDGE IF NOT EXISTS transaction (
  amount double NOT NULL,
  tx_timestamp datetime NOT NULL,
  tx_hash string NOT NULL,
  gas_used int DEFAULT 0,
  success bool DEFAULT true,
  transaction_type string DEFAULT "unknown"
);

-- 创建关联关系边
CREATE EDGE IF NOT EXISTS related_to (
  relationship_score double NOT NULL,
  common_transactions int DEFAULT 0,
  total_amount double DEFAULT 0.0,
  first_interaction datetime,
  last_interaction datetime,
  relationship_type string DEFAULT "unknown",
  avg_gas_used double DEFAULT 0.0
);
