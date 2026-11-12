-- Executed by the postgres image only when its data volume is empty.
-- The integration tests use this separate database and create a schema per test.
CREATE DATABASE hn_crawler_test;
