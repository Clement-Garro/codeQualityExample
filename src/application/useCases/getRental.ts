import { computeRentalPrice } from '../../domain/pricing';
import { Rental } from '../../domain/rental';
import { Clock } from '../ports/clock';
import { RentalRepository, UserRepository } from '../ports/repositories';
import { requireExisting } from '../requireExisting';
import { refuse, RentalLookupRefusal, Result, succeed } from '../result';

export interface GetRentalDependencies {
  readonly rentals: RentalRepository;
  readonly users: UserRepository;
  readonly clock: Clock;
}

export interface RentalDetails {
  readonly rental: Rental;
  /** Running duration of an open rental, final duration once the bike is returned. */
  readonly durationMinutes: number;
  /** Computed with the current subscription of the user. */
  readonly price: number;
  readonly isOpen: boolean;
}

export class GetRental {
  constructor(private readonly deps: GetRentalDependencies) {}

  execute(rentalId: number): Result<RentalDetails, RentalLookupRefusal> {
    const rental = this.deps.rentals.findById(rentalId);
    if (rental === undefined) {
      return refuse(RentalLookupRefusal.RentalNotFound);
    }
    const user = requireExisting(
      this.deps.users.findById(rental.userId),
      'user ' + rental.userId + ' of rental ' + rental.id
    );
    const durationMinutes = rental.durationMinutesAt(this.deps.clock.now());
    return succeed({
      rental: rental,
      durationMinutes: durationMinutes,
      price: computeRentalPrice(durationMinutes, rental.isElectric, user.subscription),
      isOpen: rental.isOpen()
    });
  }
}
