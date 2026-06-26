#!/bin/bash

# Modify ActionDialogs.jsx to use useMemo and playerMap

sed -i "s/import React, { useState } from 'react';/import React, { useState, useMemo } from 'react';/" src/components/district-exchange/ActionDialogs.jsx
