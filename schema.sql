-- ISC License
-- 
-- Copyright (c) 2025, Kirahi LLC
-- Max Seenisamy kirahi.com
-- 
-- Database schema for Secrets Management System

CREATE TABLE "passwords" (
	"id"	INTEGER NOT NULL,
	"sitename"	TEXT,
	"siteurl"	TEXT NOT NULL,
	"username"	TEXT NOT NULL,
	"password"	TEXT NOT NULL,
	"email"	TEXT NOT NULL,
	"securityqs"	TEXT,
	"securityans"	TEXT,
	"createdon"	TEXT NOT NULL,
	"createdtime"	TEXT NOT NULL,
	"updatedon"	TEXT NOT NULL,
	"updatedtime"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);