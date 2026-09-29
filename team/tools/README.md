# Headshot normalizer

Turns an arbitrary photo into a square portrait with a flat background and a
consistent head size, so a row of headshots reads as one set.

    swiftc -Onone detect.swift -o detect      # once, ~40s
    python3 compose.py <in.jpg> <out.jpg> [k=v ...]

`detect` (Swift + Vision) finds the face box and the subject matte. `compose.py`
does the crop and composite in 8-bit sRGB with PIL — deliberately not in
CoreImage, whose linear working space crushes dark background colours to black.

Options: `size=800` `face_frac=0.36` `face_cy=0.47` `bg=#1A1A1A` `erode=N`
`feather=1.5`.

`face_frac` is the face box as a fraction of the square, and `face_cy` is where
the face centre sits top-down — those two are what make head sizes match. Raise
`erode` when the original had a bright background and a light rim survives
around hair and shoulders.

Values used for the current About page portraits:

| file | erode | notes |
|---|---|---|
| chris-kolb | 1 | dark studio original, little halo to remove |
| garrett-kolb | 2 | grey studio original |
| david-silva | 6 | shot outdoors at golden hour, strong rim light |
