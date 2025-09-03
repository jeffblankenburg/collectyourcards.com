#!/bin/bash
# Rollback script - restore from git
git checkout -- server/routes/*.js server/middleware/*.js
echo "Rolled back to previous state"
