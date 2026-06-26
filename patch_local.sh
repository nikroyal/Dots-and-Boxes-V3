#!/bin/bash

sed -i "s/import React, { useState, useEffect } from 'react';/import React, { useState, useEffect, useMemo } from 'react';/" src/pages/LocalDistrictExchange.jsx
