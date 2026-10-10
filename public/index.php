<?php
require __DIR__.'/../src/bootstrap.php';
require ROOT.'/src/cms.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');
echo cmsRenderPage();
