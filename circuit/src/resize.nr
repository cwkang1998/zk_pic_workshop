// Resize circuit ported from circom template.

global H_ORIG: u32 = 64;
global W_ORIG: u32 = 64;
global H_NEW: u32 = 32;
global W_NEW: u32 = 32;

pub fn resize(orig: [[u32; W_ORIG]; H_ORIG], new: [[u32; W_NEW]; H_NEW]) -> u32 {
    for i in 0..H_NEW {
        for j in 0..W_NEW {
            let x_l = ((W_ORIG - 1) * j) / (W_NEW - 1);
            let y_l = ((H_ORIG - 1) * i) / (H_NEW - 1);

            let x_h = if x_l * (W_NEW - 1) == (W_ORIG - 1) * j { x_l } else { x_l + 1 };
            let y_h = if y_l * (H_NEW - 1) == (H_ORIG - 1) * i { y_l } else { y_l + 1 };

            let x_ratio_weighted = ((W_ORIG - 1) * j) - (W_NEW - 1) * x_l;
            let y_ratio_weighted = ((H_ORIG - 1) * i) - (H_NEW - 1) * y_l;

            let denom = (W_NEW - 1) * (H_NEW - 1);

            let w_a = (W_NEW - 1 - x_ratio_weighted) as u64;
            let w_b = x_ratio_weighted as u64;
            let h_a = (H_NEW - 1 - y_ratio_weighted) as u64;
            let h_b = y_ratio_weighted as u64;

            let sum = (orig[y_l][x_l] as u64) * w_a * h_a
                + (orig[y_l][x_h] as u64) * w_b * h_a
                + (orig[y_h][x_l] as u64) * w_a * h_b
                + (orig[y_h][x_h] as u64) * w_b * h_b;

            let denom_u64 = denom as u64;
            let sum_plus = sum + (denom_u64 / 2);
            let new_val = new[i][j] as u64;

            // Nearest-neighbor rounding: floor((sum + denom/2) / denom)
            assert(new_val * denom_u64 <= sum_plus);
            assert(sum_plus < (new_val + 1) * denom_u64);
        }
    }

    1
}
