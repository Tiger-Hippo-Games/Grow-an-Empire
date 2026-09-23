param(
  [string]$ArtDirectory = (Join-Path $PSScriptRoot '..\Assets\Art\Generated 512'),
  [string]$SourceName = '*'
)

Add-Type -AssemblyName System.Drawing

$poses = @(
  @{ Lean = -3.5; Bounce = 2; LeftStep = -5; RightStep = 5 },
  @{ Lean = -1.0; Bounce = -4; LeftStep = 1; RightStep = -1 },
  @{ Lean = 3.5; Bounce = 2; LeftStep = 5; RightStep = -5 },
  @{ Lean = 1.0; Bounce = -4; LeftStep = -1; RightStep = 1 }
)

foreach ($file in Get-ChildItem -LiteralPath $ArtDirectory -Filter '*.png' | Where-Object { $_.Name -like $SourceName -and $_.BaseName -notlike '*-walk4' -and $_.BaseName -notlike '*-attack4' }) {
  $source = [System.Drawing.Bitmap]::FromFile($file.FullName)
  try {
    if ($source.Width -ne 512 -or $source.Height -ne 512) {
      throw "$($file.Name) must be 512 x 512 pixels"
    }

    $sheet = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $sheetGraphics = [System.Drawing.Graphics]::FromImage($sheet)
      try {
        $sheetGraphics.Clear([System.Drawing.Color]::Transparent)
        $sheetGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $sheetGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        for ($frame = 0; $frame -lt 4; $frame++) {
          $pose = $poses[$frame]
          $cell = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
          try {
            $cellGraphics = [System.Drawing.Graphics]::FromImage($cell)
            try {
              $cellGraphics.Clear([System.Drawing.Color]::Transparent)
              $cellGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
              $cellGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
              $baseRect = [System.Drawing.Rectangle]::new(10, 8, 236, 238)
              $cellGraphics.DrawImage($source, $baseRect)

              # Shift the two lower halves in opposite directions for alternating steps.
              $cellGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
              $cellGraphics.FillRectangle([System.Drawing.Brushes]::Transparent, [System.Drawing.Rectangle]::new(0, 174, 256, 82))
              $cellGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
              $cellGraphics.SetClip([System.Drawing.Rectangle]::new(0, 174, 128, 82))
              $cellGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(10 + $pose.LeftStep, 8, 236, 238))
              $cellGraphics.SetClip([System.Drawing.Rectangle]::new(128, 174, 128, 82))
              $cellGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(10 + $pose.RightStep, 8, 236, 238))
              $cellGraphics.ResetClip()
            }
            finally { $cellGraphics.Dispose() }

            $x = ($frame % 2) * 256
            $y = [Math]::Floor($frame / 2) * 256
            $saved = $sheetGraphics.Save()
            try {
              $sheetGraphics.TranslateTransform($x + 128, $y + 128)
              $sheetGraphics.RotateTransform($pose.Lean)
              $sheetGraphics.DrawImage($cell, [System.Drawing.Rectangle]::new(-128, -128 + $pose.Bounce, 256, 256))
            }
            finally { $sheetGraphics.Restore($saved) }
          }
          finally { $cell.Dispose() }
        }
      }
      finally { $sheetGraphics.Dispose() }

      $output = Join-Path $ArtDirectory ($file.BaseName + '-walk4.png')
      $sheet.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output $output
    }
    finally { $sheet.Dispose() }
  }
  finally { $source.Dispose() }
}
