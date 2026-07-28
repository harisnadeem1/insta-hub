$exclude = @("node_modules", ".git", "dist", "build", ".next", "coverage",".pw-instagram-session")

function Show-Tree {
    param(
        [string]$Path = ".",
        [string]$Indent = ""
    )

    $items = Get-ChildItem -LiteralPath $Path |
        Where-Object { $exclude -notcontains $_.Name } |
        Sort-Object @{Expression = {!$_.PSIsContainer}}, Name

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]

        $isLast = ($i -eq ($items.Count - 1))
        $branch = if ($isLast) { "\-- " } else { "+-- " }

        Add-Content -Path "structure.txt" -Value "$Indent$branch$($item.Name)"

        if ($item.PSIsContainer) {
            $newIndent = if ($isLast) { "$Indent    " } else { "$Indent|   " }
            Show-Tree -Path $item.FullName -Indent $newIndent
        }
    }
}

if (Test-Path "structure.txt") {
    Remove-Item "structure.txt"
}

$root = Split-Path (Get-Location) -Leaf
Add-Content -Path "structure.txt" -Value $root

Show-Tree

Write-Host "Done! Output saved to structure.txt"